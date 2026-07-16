import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Detection, loadModel, runInferenceOnTensor } from '@/utils/onnx';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
// vision-camera-resize-plugin is temporarily disabled (incompatible with VisionCamera v5)
// import { useResizePlugin } from 'vision-camera-resize-plugin';

const MODEL_SIZE = 640;
const INFERENCE_INTERVAL_MS = 700; // throttle : pas d'inférence à chaque frame, sinon ça sature

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [loadingModel, setLoadingModel] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [status, setStatus] = useState('Initialisation...');
  const device = useCameraDevice('back');
  // const { resize } = useResizePlugin();

  const lastInferenceTime = useRef(0);
  const isInferencingRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  useEffect(() => {
    setLoadingModel(true);
    setStatus('Chargement du modèle...');
    loadModel()
      .then(() => setStatus('Modèle chargé — flux actif'))
      .catch((e) => setStatus(`Erreur chargement: ${e?.message ?? e}`))
      .finally(() => setLoadingModel(false));
  }, []);

  // Callback JS (hors worklet) qui reçoit le buffer redimensionné et lance l'inférence async
  async function handleResizedFrame(resizedData: Uint8Array | Float32Array) {
    if (isInferencingRef.current) return; // évite les inférences qui se chevauchent
    isInferencingRef.current = true;
    try {
      const results = await runInferenceOnTensor(resizedData, MODEL_SIZE);
      setDetections(results ?? []);
    } catch (e: any) {
      setStatus(`Erreur inférence: ${e?.message ?? e}`);
    } finally {
      isInferencingRef.current = false;
    }
  }

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const now = Date.now();
      // Throttle : on ne déclenche l'inférence que toutes les INFERENCE_INTERVAL_MS
      if (now - lastInferenceTime.current < INFERENCE_INTERVAL_MS) return;
      lastInferenceTime.current = now;

      // vision-camera-resize-plugin disabled: skipping native resize + inference
      // Redimensionnement et appel d'inférence désactivés temporairement
      // const resized = resize(frame, {
      //   scale: { width: MODEL_SIZE, height: MODEL_SIZE },
      //   pixelFormat: 'rgb',
      //   dataType: 'float32',
      // });
      // runOnJS(handleResizedFrame)(resized);
    },
    []
  );

  if (device == null || hasPermission === undefined) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if (!hasPermission) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ThemedView style={styles.center}>
          <Text>Permission caméra refusée</Text>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1 }}>
        <Camera
          style={styles.preview}
          device={device}
          isActive
          frameProcessor={frameProcessor}
        />

        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{status}</Text>
          {loadingModel && <ActivityIndicator color="white" />}
        </View>

        {/* Bounding boxes overlay */}
        {detections.map((d, idx) => (
          <View
            key={idx}
            style={[
              styles.box,
              {
                left: `${d.box.x * 100}%`,
                top: `${d.box.y * 100}%`,
                width: `${d.box.width * 100}%`,
                height: `${d.box.height * 100}%`,
              },
            ]}
          >
            <Text style={styles.boxLabel}>
              {d.label} {(d.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        ))}

        <View style={styles.bottomBar}>
          <Text style={styles.detectionCount}>
            {detections.length} objet(s) détecté(s)
          </Text>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  preview: { flex: 1, backgroundColor: 'black' },
  bottomBar: {
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  detectionCount: { color: 'white', fontWeight: '600' },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    top: Spacing.three,
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  overlayText: { color: 'white', marginBottom: Spacing.one },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00ff00',
  },
  boxLabel: {
    color: '#00ff00',
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});