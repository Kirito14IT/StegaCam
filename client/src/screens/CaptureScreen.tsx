import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskQueue } from '../queue/TaskQueueProvider';
import type { EncodeResult, Task } from '../queue/TaskTypes';
import { getShortId } from '../utils/storage';

const isEncodeSuccessTask = (
  task: Task
): task is Extract<Task, { type: 'ENCODE' }> & {
  status: 'SUCCESS';
  result: EncodeResult & { savedAssetId: string };
} => {
  return (
    task.type === 'ENCODE' &&
    task.status === 'SUCCESS' &&
    !!task.result &&
    typeof task.result.savedAssetId === 'string' &&
    !!task.result.saved
  );
};

type CameraFacing = 'back' | 'front';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [shortId, setShortId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [previewExternalUri, setPreviewExternalUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isPreviewModalVisible, setPreviewModalVisible] = useState(false);
  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);
  const { enqueueEncode, state } = useTaskQueue();
  const insets = useSafeAreaInsets();

  const getAndroidMediaStoreUri = useCallback((assetId?: string | null) => {
    if (!assetId) {
      return null;
    }
    const match = /(\d+)$/.exec(assetId);
    if (!match) {
      return null;
    }
    return `content://media/external/images/media/${match[1]}`;
  }, []);

  const getAndroidContentUri = useCallback(
    async (uri: string | null | undefined, assetId?: string | null) => {
      if (Platform.OS !== 'android') {
        return uri ?? null;
      }
      const mediaStoreUri = getAndroidMediaStoreUri(assetId);
      if (mediaStoreUri) {
        return mediaStoreUri;
      }
      if (!uri) {
        return null;
      }
      if (!uri.startsWith('file://')) {
        return uri;
      }
      try {
        return await getContentUriAsync(uri);
      } catch (conversionError) {
        console.warn('Failed to convert file URI to content URI', conversionError);
        return null;
      }
    },
    [getAndroidMediaStoreUri]
  );

  const resolvePreviewUris = useCallback(
    async (
      displayCandidates: Array<string | null | undefined>,
      externalCandidates: Array<string | null | undefined>,
      assetId?: string | null
    ) => {
      const displayUri = displayCandidates.find(Boolean) ?? null;
      const preferredExternal = externalCandidates.find(Boolean) ?? null;
      const externalUri =
        Platform.OS === 'android'
          ? await getAndroidContentUri(preferredExternal ?? displayUri, assetId)
          : preferredExternal;

      return { displayUri, externalUri };
    },
    [getAndroidContentUri]
  );

  const ensureMediaPermission = useCallback(async () => {
    const granularPermissions: MediaLibrary.GranularPermission[] | undefined =
      Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33
        ? ['photo']
        : undefined;
    const current = await MediaLibrary.getPermissionsAsync(false, granularPermissions);
    if (current.status === 'granted') {
      return true;
    }
    const request = await MediaLibrary.requestPermissionsAsync(false, granularPermissions);
    return request.status === 'granted';
  }, []);

  const fetchLatestPreviewAsset = useCallback(async () => {
    try {
      const hasPermission = await ensureMediaPermission();
      if (!hasPermission) {
        setPreviewAssetId(null);
        setPreviewUri(null);
        setPreviewExternalUri(null);
        return;
      }
      setPreviewLoading(true);
      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        mediaType: MediaLibrary.MediaType.photo,
      });
      if (!assets.assets.length) {
        setPreviewAssetId(null);
        setPreviewUri(null);
        setPreviewExternalUri(null);
        return;
      }
      const latest = assets.assets[0];
      const info = await MediaLibrary.getAssetInfoAsync(latest.id);
      setPreviewAssetId(latest.id);
      const { displayUri, externalUri } = await resolvePreviewUris(
        [info.localUri, info.uri, latest.uri],
        [info.uri, latest.uri, info.localUri],
        info.id ?? latest.id
      );
      setPreviewUri(displayUri);
      setPreviewExternalUri(externalUri);
    } catch (error) {
      console.warn('Failed to load recent gallery asset', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [ensureMediaPermission, resolvePreviewUris]);

  useEffect(() => {
    loadShortId();
  }, []);

  useEffect(() => {
    fetchLatestPreviewAsset();
  }, [fetchLatestPreviewAsset]);

  useFocusEffect(
    useCallback(() => {
      fetchLatestPreviewAsset();
    }, [fetchLatestPreviewAsset])
  );

  const loadShortId = async () => {
    const id = await getShortId();
    if (id) {
      setShortId(id);
    } else {
      Alert.alert('错误', '未找到Short ID, 请重新登录');
    }
  };

  useEffect(() => {
    const latestEncode = [...state.tasks]
      .filter(isEncodeSuccessTask)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];

    if (!latestEncode) {
      return;
    }

    const assetId = latestEncode.result?.savedAssetId;
    if (!assetId) {
      return;
    }
    if (assetId === previewAssetId && previewUri) {
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const hasPermission = await ensureMediaPermission();
        if (!hasPermission) {
          return;
        }
        const info = await MediaLibrary.getAssetInfoAsync(assetId);
        if (!cancelled) {
          const { displayUri, externalUri } = await resolvePreviewUris(
            [info.localUri, info.uri],
            [info.uri, info.localUri],
            info.id ?? assetId
          );
          setPreviewAssetId(assetId);
          setPreviewUri(displayUri);
          setPreviewExternalUri(externalUri);
        }
      } catch (error) {
        console.warn('Failed to load preview asset', error);
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.tasks, previewAssetId, previewUri, ensureMediaPermission, resolvePreviewUris]);

  const onCapture = async () => {
    if (!cameraRef.current || !shortId || isCapturing) return;
    
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });
      
      if (photo?.uri) {
        enqueueEncode([{ uri: photo.uri, source: 'capture' }], shortId);
        // No alert here - task completion will be notified via useEffect
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败，请重试');
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleCameraType = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const closePreviewModal = useCallback(() => {
    setPreviewModalVisible(false);
  }, []);

  const openPreviewExternally = useCallback(async () => {
    const preferredUri = Platform.OS === 'android' ? previewExternalUri ?? previewUri : previewUri ?? previewExternalUri;
    if (!preferredUri) {
      Alert.alert('暂无图片', '先拍摄并完成加密后，可在此快速访问最近的图片。');
      return;
    }
    try {
    const targetUri =
      Platform.OS === 'android' ? await getAndroidContentUri(preferredUri, previewAssetId) : preferredUri;

    if (!targetUri) {
      Alert.alert('无法打开相册', '请在系统相册中手动查看最近保存的图片。');
      return;
      }

      await Linking.openURL(targetUri);
      closePreviewModal();
    } catch (error) {
      console.warn('Unable to open gallery', error);
      if (Platform.OS === 'ios') {
        try {
          await Linking.openURL('photos-redirect://');
          closePreviewModal();
          return;
        } catch (iosError) {
          console.warn('Fallback photos redirect failed', iosError);
        }
      }
      Alert.alert('无法打开相册', '请在系统相册中手动查看最近保存的图片。');
    }
  }, [closePreviewModal, getAndroidContentUri, previewAssetId, previewExternalUri, previewUri]);

  const handleOpenPreview = useCallback(() => {
    if (previewLoading) return;
    if (!previewUri) {
      Alert.alert('暂无图片', '先拍摄并完成加密后，可在此快速访问最近的图片。');
      return;
    }
    setPreviewModalVisible(true);
  }, [previewLoading, previewUri]);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>需要相机权限</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>授权</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const encodeQueue = state.tasks.filter(
    (t) => t.type === 'ENCODE' && (t.status === 'QUEUED' || t.status === 'PENDING')
  );
  const runningEncodeTask = state.tasks.find(
    (t) => t.type === 'ENCODE' && t.id === state.runningTaskId
  );
  const processingCount = state.tasks.filter(
    (t) => t.type === 'ENCODE' && t.status === 'PROCESSING'
  ).length;
  const totalActive = encodeQueue.length + processingCount;
  const queueMessage =
    totalActive === 0
      ? '队列空闲'
      : runningEncodeTask
        ? `处理中，剩余 ${totalActive} 张`
        : `排队中 ${totalActive} 张`;

  return (
    <>
      <Modal
        visible={isPreviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreviewModal}
      >
        <View style={styles.previewModalOverlay}>
          <Pressable style={styles.previewModalBackdrop} onPress={closePreviewModal} />
          <View style={styles.previewModalCard}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewModalImage} />
            ) : (
              <View style={styles.previewModalPlaceholder}>
                <Text style={styles.previewModalPlaceholderText}>暂无可预览的图片</Text>
              </View>
            )}
            <View style={styles.previewModalActions}>
              <TouchableOpacity style={styles.previewModalButton} onPress={openPreviewExternally}>
                <Text style={styles.previewModalButtonText}>在系统相册中查看</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewModalButton, styles.previewModalCloseButton]}
                onPress={closePreviewModal}
              >
                <Text style={styles.previewModalButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Queue badge */}
          <View style={styles.queueBadge}>
            <View style={[styles.queueCounter, totalActive === 0 && styles.queueCounterIdle]}>
              <Text style={styles.queueCounterText}>{totalActive}</Text>
            </View>
            <Text style={styles.queueBadgeText}>{queueMessage}</Text>
          </View>

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType}>
            <Text style={styles.flipButtonText}>翻转</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
          <View
            style={[
              styles.bottomControls,
              {
                paddingBottom: Math.max(insets.bottom + 16, 28),
              },
            ]}
          >
            <View style={styles.bottomLeftSlot}>
              <TouchableOpacity
                style={[
                  styles.previewButton,
                  (!previewUri || previewLoading) && styles.previewButtonDisabled,
                ]}
                onPress={handleOpenPreview}
                disabled={previewLoading}
                activeOpacity={0.8}
              >
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.previewPlaceholder}>
                    <Text style={styles.previewPlaceholderText}>相册</Text>
                  </View>
                )}
                {previewLoading && (
                  <View style={styles.previewOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.bottomCenterSlot}>
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={onCapture}
            disabled={isCapturing || !shortId}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
            </View>

            <View style={styles.bottomRightSlot} />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  flipButton: {
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  bottomLeftSlot: {
    width: 64,
    alignItems: 'center',
  },
  bottomCenterSlot: {
    flex: 1,
    alignItems: 'center',
  },
  bottomRightSlot: {
    width: 64,
  },
  previewButtonDisabled: {
    opacity: 0.6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56,189,248,0.25)',
    borderWidth: 4,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc',
  },
  queueBadge: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  queueCounter: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 11,
    backgroundColor: 'rgba(56,189,248,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueCounterIdle: {
    backgroundColor: 'rgba(226,232,240,0.35)',
  },
  queueCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.9)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewModalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,23,42,0.65)',
  },
  previewModalCard: {
    width: '82%',
    backgroundColor: '#111827',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  previewModalImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#0f172a',
  },
  previewModalPlaceholder: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalPlaceholderText: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  previewModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    gap: 12,
  },
  previewModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
  },
  previewModalCloseButton: {
    backgroundColor: '#334155',
  },
  previewModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

