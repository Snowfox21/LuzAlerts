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
import { setPendingLink } from '../src/utils/pendingLink';
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

    // Разбор диплинка в маршрут приложения: luzalerts://report/123 и
    // https://luzalerts.lat/r/CODE. Возвращает путь, а не навигирует, чтобы
    // тот же разбор годился и для отложенной ссылки.
    const resolveDeepLinkRoute = useCallback((url: string): string | null => {
        const { hostname, path } = Linking.parse(url);

        // У кастомной схемы первый сегмент уезжает в hostname:
        // luzalerts://report/16 разбирается как hostname="report", path="16",
        // и матчить один path бесполезно. У https-ссылки hostname — это домен
        // (luzalerts.lat), а путь целиком лежит в path. Поэтому склеиваем, но
        // домен отбрасываем.
        const segments = [hostname, path]
            .filter((part): part is string => Boolean(part) && part !== 'luzalerts.lat')
            .join('/')
            .replace(/^\/+|\/+$/g, '');
        if (!segments) return null;

        const direct = segments.match(/^report\/(\d+)$/);
        if (direct) return `/report/${direct[1]}`;

        const shared = segments.match(/^r\/([A-Za-z0-9]+)$/);
        if (shared) return `/r/${shared[1]}`;

        return null;
    }, []);

    const openFromUrl = useCallback((url: string) => {
        const route = resolveDeepLinkRoute(url);
        // navigate, а не push: этот же диплинк expo-router разбирает и сам,
        // и push положил бы второй такой же экран в стек — "назад"
        // упиралось бы в дубль.
        if (route) router.navigate(route);
    }, [resolveDeepLinkRoute]);

    useEffect(() => {
        // Оба ответа ждем вместе. По отдельности между ними гонка, и она
        // стабильно проигрывалась: флаг онбординга из AsyncStorage приходил
        // первым, ссылка из getInitialURL еще не была прочитана, ветка
        // "онбординг не пройден" видела пустой ref и ничего не откладывала.
        // Ссылка приезжала следом, ложилась в ref — и больше ее никто не
        // читал. Ровно тот случай, ради которого все делалось: сосед из
        // WhatsApp ставит приложение, проходит онбординг и не видит метки.
        Promise.all([
            // Провал чтения не должен подвесить readiness: без него диплинки
            // остались бы в очереди навсегда.
            AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null),
            Linking.getInitialURL().catch(() => null),
        ]).then(([done, initialUrl]) => {
            const url = initialUrl ?? pendingUrlRef.current;
            pendingUrlRef.current = null;
            const route = url ? resolveDeepLinkRoute(url) : null;

            if (!done) {
                router.replace('/onboarding');
                // Маршрут переживает онбординг: его заберет последний шаг
                // онбординга и откроет метку вместо карты.
                if (route) setPendingLink(route);
            } else {
                onboardingDoneRef.current = true;
                setOnboardingDone(true);
                if (route) router.navigate(route);
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
            if (!onboardingDoneRef.current) {
                // Онбординг еще идет (или ответ про него не пришел). Кладем и
                // в ref — на случай, если ответ еще впереди, — и в
                // pendingLink, чтобы ссылка, прилетевшая уже поверх
                // открытого онбординга, тоже дожила до его финала.
                pendingUrlRef.current = url;
                const route = resolveDeepLinkRoute(url);
                if (route) setPendingLink(route);
                return;
            }
            openFromUrl(url);
        };

        // Холодный старт разбирается выше, вместе с флагом онбординга:
        // здесь остаются только ссылки, прилетевшие в уже живое приложение.

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
