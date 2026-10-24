import { Alert, AlertButton, Platform } from 'react-native';

// В react-native-web Alert.alert — пустышка: в PWA ни одно сообщение и ни
// одно подтверждение не появлялось, кнопки выглядели "не нажимающимися".
// Подменяем на браузерные alert/confirm: два варианта ответа confirm
// покрывает, а больше кнопок в приложении нигде нет.
export function installWebAlert() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
        const text = [title, message].filter(Boolean).join('\n\n');
        const list = buttons ?? [];
        const cancel = list.find(b => b.style === 'cancel');
        const actions = list.filter(b => b !== cancel);

        if (list.length < 2) {
            window.alert(text);
            list[0]?.onPress?.();
            return;
        }
        // Основное действие — последняя не-cancel кнопка, как в нативном диалоге.
        if (window.confirm(text)) {
            actions[actions.length - 1]?.onPress?.();
        } else {
            (cancel ?? actions[0])?.onPress?.();
        }
    };
}
