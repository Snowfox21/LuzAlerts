import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LogBox, Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/theme/Theme';
import { useDeviceSetup } from '../src/hooks/useDeviceSetup';
import { ONBOARDING_KEY } from './onboarding';
import { checkForUpdate } from '../src/update/checkForUpdate';
import { UpdateManifest } from '../src/update/manifest';
import { UpdateSheet } from '../src/update/UpdateSheet';

LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications',
    '`expo-notifications` functionality is not fully supported',
    'No "projectId" found',
]);

try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch {}

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'dark';
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);
    const [update, setUpdate] = useState<UpdateManifest | null>(null);
    // Отдельное состояние, а не onboardingDoneRef: на ref эффект проверки
    // обновления не переподпишется, а нам нужно дождаться ответа про онбординг.
    const [onboardingDone, setOnboardingDone] = useState(false);

    useDeviceSetup();

    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setVisibilityAsync('hidden');
            NavigationBar.setBehaviorAsync('overlay-swipe');
        }
    }, []);

    // Диплинк, пришедший раньше, чем стало известно про онбординг, ждет
    // здесь: router.replace('/onboarding') затер бы открытый по ссылке
    // экран метки, а сосед пришел из WhatsApp именно за ней.
    const pendingUrlRef = useRef<string | null>(null);
    const onboardingDoneRef = useRef(false);

    // Разбор диплинка: luzalerts://report/123 и https://luzalerts.lat/r/CODE.
    const openFromUrl = useCallback((url: string) => {
        const { path } = Linking.parse(url);
        if (!path) return;

        const direct = path.match(/^report\/(\d+)$/);
        if (direct) {
            // navigate, а не push: этот же диплинк expo-router разбирает и
            // сам по схеме приложения, и push положил бы второй такой же
            // экран в стек — "назад" упиралось бы в дубль.
            router.navigate(`/report/${direct[1]}`);
            return;
        }

        // Веб-ссылка несет публичный код, а не id: разрешаем его в id
        // на бэкенде, отдельного экрана под код заводить незачем.
        const shared = path.match(/^r\/([A-Za-z0-9]+)$/);
        if (shared) {
            router.navigate(`/report/code/${shared[1]}`);
        }
    }, []);

    useEffect(() => {
        AsyncStorage.getItem(ONBOARDING_KEY)
            // Провал чтения не должен подвесить readiness: без него диплинки
            // остались бы в очереди навсегда.
            .catch(() => null)
            .then(done => {
                if (!done) {
                    router.replace('/onboarding');
                    // Ссылку роняем: онбординг — жесткий шлюз, открывать
                    // метку поверх него некуда.
                    pendingUrlRef.current = null;
                } else {
                    onboardingDoneRef.current = true;
                    setOnboardingDone(true);
                    const pending = pendingUrlRef.current;
                    pendingUrlRef.current = null;
                    if (pending) openFromUrl(pending);
                }
                setReady(true);
            });
    }, []);

    // Navigate to map when user taps a push notification
    useEffect(() => {
        try {
            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                const data = response.notification.request.content.data;
                if (data?.lat && data?.lon) {
                    router.push(`/(tabs)?focusLat=${data.lat}&focusLon=${data.lon}`);
                } else {
                    router.push('/(tabs)');
                }
            });
        } catch {}

        return () => {
            responseListener.current?.remove();
        };
    }, []);

    useEffect(() => {
        const handle = (url: string | null) => {
            if (!url) return;
            // До ответа про онбординг навигировать нельзя — придерживаем.
            if (!onboardingDoneRef.current) {
                pendingUrlRef.current = url;
                return;
            }
            openFromUrl(url);
        };

        // Холодный старт: приложение подняли самой ссылкой, слушатель
        // подписаться уже не успел.
        Linking.getInitialURL().then(handle).catch(() => {});

        const sub = Linking.addEventListener('url', event => handle(event.url));
        return () => sub.remove();
    }, [openFromUrl]);

    // Обновление вне Google Play: стора, который догонял бы пользователей,
    // у сайдлоада нет. Задержка — чтобы проверка не конкурировала за сеть
    // со стартовой загрузкой карты.
    //
    // Ждем онбординг: иначе человек, впервые открывший приложение, получает
    // предложение скачать 110 МБ поверх экрана "что это вообще такое" —
    // диалог всплывает над онбордингом и перекрывает его кнопки. Тому, кто
    // проходит онбординг прямо сейчас, проверка достанется на следующем
    // запуске, и это правильный момент: сначала показать продукт.
    useEffect(() => {
        if (!onboardingDone) return;
        const timer = setTimeout(() => {
            checkForUpdate()
                .then(result => setUpdate(result?.manifest ?? null))
                .catch(() => {});
        }, 3000);
        return () => clearTimeout(timer);
    }, [onboardingDone]);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: Colors[colorScheme].background,
                    },
                    headerTintColor: Colors[colorScheme].text,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    headerShadowVisible: false,
                    headerBackTitle: '',
                }}>
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <UpdateSheet manifest={update} onDismiss={() => setUpdate(null)} />
        </GestureHandlerRootView>
    );
}
