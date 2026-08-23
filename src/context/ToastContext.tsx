import React, { createContext, useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  Animated, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Modal,
  TouchableWithoutFeedback,
  useColorScheme
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
}

export interface DialogOptions {
  title: string;
  message: string;
  buttons?: DialogButton[];
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
}

export const ToastContext = createContext<ToastContextData>({} as ToastContextData);

const sanitizeTitle = (title: string): string => {
  if (!title) return title;
  const lower = title.toLowerCase();
  if (
    lower.includes('dev') ||
    lower.includes('server') ||
    lower.includes('database') ||
    lower.includes('api') ||
    lower.includes('internal') ||
    lower.includes('network') ||
    lower.includes('setup failed')
  ) {
    return 'Connection Error';
  }
  return title;
};

const sanitizeMessage = (message: string): string => {
  if (!message) return message;
  const lower = message.toLowerCase();
  if (
    lower.includes('dev server') ||
    lower.includes('server is running') ||
    lower.includes('localhost') ||
    lower.includes('render.com') ||
    lower.includes('prisma') ||
    lower.includes('database') ||
    lower.includes('sql') ||
    lower.includes('connection refused') ||
    lower.includes('connect to') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('err_connection') ||
    lower.includes('timeout') ||
    lower.includes('500') ||
    lower.includes('internal server error') ||
    lower.includes('failed with status') ||
    lower.includes('missing session') ||
    lower.includes('supabase') ||
    lower.includes('could not reach') ||
    lower.includes('check backend connection')
  ) {
    return 'Could not connect to the service. Please check your internet connection or try again later.';
  }
  return message;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Toast State
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog State
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);

  const hideToast = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setToastVisible(false);
      setToast(null);
    });
  }, [fadeAnim, slideAnim]);

  // Show Toast Implementation
  const showToast = React.useCallback(({ title, message, type = 'info', duration = 3000 }: ToastOptions) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const cleanTitle = type === 'error' ? sanitizeTitle(title) : title;
    const cleanMessage = type === 'error' ? sanitizeMessage(message) : message;

    setToast({ title: cleanTitle, message: cleanMessage, type, duration });
    setToastVisible(true);

    // Animate In
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 50, // Top margin
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    // Auto hide
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [fadeAnim, slideAnim, hideToast]);

  // Show Dialog Implementation
  const showDialog = React.useCallback((options: DialogOptions) => {
    const isError = options.title.toLowerCase().includes('fail') || 
                    options.title.toLowerCase().includes('error') || 
                    options.title.toLowerCase().includes('expire') || 
                    options.title.toLowerCase().includes('unsupported');

    const cleanTitle = isError ? sanitizeTitle(options.title) : options.title;
    const cleanMessage = isError ? sanitizeMessage(options.message) : options.message;

    setDialog({
      ...options,
      title: cleanTitle,
      message: cleanMessage,
    });
    setDialogVisible(true);
  }, []);

  const hideDialog = React.useCallback(() => {
    setDialogVisible(false);
    setDialog(null);
  }, []);

  // Get matching icon and color scheme for toast
  const getToastStyle = (type: ToastType, isDarkTheme: boolean) => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle' as const,
          color: isDarkTheme ? colors.primary : '#10B981', // Sky blue in dark mode, Emerald in light mode
          glow: isDarkTheme ? 'rgba(156, 209, 199, 0.15)' : 'rgba(16, 185, 129, 0.1)',
        };
      case 'error':
        return {
          icon: 'error-outline' as const,
          color: isDarkTheme ? colors.error.DEFAULT : '#EF4444', // Coral Red in dark mode, Red in light mode
          glow: isDarkTheme ? 'rgba(255, 180, 171, 0.15)' : 'rgba(239, 68, 68, 0.1)',
        };
      case 'warning':
        return {
          icon: 'warning-amber' as const,
          color: isDarkTheme ? colors.gold : '#D97706', // Gold in dark mode, Amber in light mode
          glow: isDarkTheme ? 'rgba(213, 198, 142, 0.15)' : 'rgba(217, 119, 6, 0.1)',
        };
      case 'info':
      default:
        return {
          icon: 'info-outline' as const,
          color: isDarkTheme ? '#8be9fd' : '#2563EB', // Soft blue in dark mode, Royal blue in light mode
          glow: isDarkTheme ? 'rgba(139, 233, 253, 0.15)' : 'rgba(37, 99, 235, 0.1)',
        };
    }
  };

  const currentStyle = toast ? getToastStyle(toast.type || 'info', isDark) : null;
  const contextValue = React.useMemo(() => ({ showToast, showDialog, hideDialog }), [showToast, showDialog, hideDialog]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Floating Animated Toast Banner */}
      {toastVisible && toast && currentStyle && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              borderColor: currentStyle.color,
              shadowColor: isDark ? currentStyle.color : 'rgba(0, 0, 0, 0.1)',
              backgroundColor: isDark ? 'rgba(29, 32, 33, 0.95)' : 'rgba(255, 255, 255, 0.98)', // Glassmorphism backdrop
            }
          ]}
        >
          <View style={styles.toastContent}>
            <View style={[styles.iconWrapper, { backgroundColor: currentStyle.glow }]}>
              <MaterialIcons name={currentStyle.icon} size={22} color={currentStyle.color} />
            </View>
            <View style={styles.textWrapper}>
              <Text style={[styles.toastTitle, { color: currentStyle.color }]}>{toast.title}</Text>
              <Text style={[styles.toastMessage, { color: isDark ? '#c0c8c5' : colors.text.muted }]}>{toast.message}</Text>
            </View>
            <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
              <MaterialIcons name="close" size={16} color={colors.text.outline} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Gorgeous Dark Emerald Dialog Modal */}
      <Modal
        visible={dialogVisible}
        transparent
        animationType="fade"
        onRequestClose={hideDialog}
      >
        <TouchableWithoutFeedback onPress={hideDialog}>
          <View style={[styles.modalBackdrop, { backgroundColor: isDark ? 'rgba(10, 12, 13, 0.75)' : 'rgba(10, 12, 13, 0.4)' }]}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.dialogContainer,
                {
                  backgroundColor: isDark ? '#16191a' : colors.surface.DEFAULT,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  shadowColor: isDark ? '#000' : 'rgba(0, 0, 0, 0.2)',
                }
              ]}>
                {/* Glowing top line */}
                <View style={styles.dialogGlowBar} />
                
                <View style={styles.dialogIconHeader}>
                  <View style={[
                    styles.dialogIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(156, 209, 199, 0.1)' : 'rgba(26, 26, 26, 0.05)',
                      borderColor: isDark ? 'rgba(156, 209, 199, 0.2)' : 'rgba(26, 26, 26, 0.1)',
                    }
                  ]}>
                    <MaterialIcons name="notifications-active" size={28} color={colors.primary} />
                  </View>
                </View>

                <Text style={[styles.dialogTitle, { color: isDark ? '#e1e3e4' : colors.text.DEFAULT }]}>{dialog?.title}</Text>
                <Text style={[styles.dialogMessage, { color: isDark ? '#a0a8a5' : colors.text.muted }]}>{dialog?.message}</Text>

                <View style={styles.dialogActions}>
                  {dialog?.buttons && dialog.buttons.length > 0 ? (
                    dialog.buttons.map((btn, index) => {
                      const isDestructive = btn.style === 'destructive';
                      const isCancel = btn.style === 'cancel';
                      
                      let btnBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                      let borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                      let txtCol = colors.text.DEFAULT;

                      if (isDestructive) {
                        btnBg = isDark ? 'rgba(255, 180, 171, 0.1)' : 'rgba(239, 68, 68, 0.08)';
                        borderCol = isDark ? 'rgba(255, 180, 171, 0.3)' : 'rgba(239, 68, 68, 0.2)';
                        txtCol = colors.error.DEFAULT;
                      } else if (!isCancel) {
                        btnBg = isDark ? 'rgba(156, 209, 199, 0.1)' : 'rgba(26, 26, 26, 0.05)';
                        borderCol = isDark ? 'rgba(156, 209, 199, 0.4)' : 'rgba(26, 26, 26, 0.12)';
                        txtCol = colors.primary;
                      }

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.dialogButton,
                            { 
                              backgroundColor: btnBg,
                              borderColor: borderCol,
                              flex: (dialog.buttons || []).length > 2 ? 0 : 1,
                              width: (dialog.buttons || []).length > 2 ? '100%' : 'auto',
                              marginBottom: (dialog.buttons || []).length > 2 ? 8 : 0,
                            }
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            hideDialog();
                            if (btn.onPress) btn.onPress();
                          }}
                        >
                          <Text style={[styles.dialogButtonText, { color: txtCol }]}>
                            {btn.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <TouchableOpacity
                      style={styles.dialogSingleButton}
                      activeOpacity={0.8}
                      onPress={hideDialog}
                    >
                      <Text style={[styles.dialogSingleButtonText, { color: isDark ? '#0c0f10' : '#FFFFFF' }]}>Acknowledge</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  toastMessage: {
    fontSize: 12,
    color: '#c0c8c5',
    marginTop: 2,
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#16191a',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  dialogGlowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  dialogIconHeader: {
    marginBottom: 16,
  },
  dialogIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(156, 209, 199, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156, 209, 199, 0.2)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e1e3e4',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  dialogMessage: {
    fontSize: 13,
    color: '#a0a8a5',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    flexWrap: 'wrap',
  },
  dialogButton: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dialogButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  dialogSingleButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSingleButtonText: {
    color: '#0c0f10',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
