// utils/onnx.ts
// Pipeline : buffer RGB float32 (déjà redimensionné par vision-camera-resize-plugin) -> tensor -> inference -> boxes

import { Asset } from 'expo-asset';

let session: any = null;

const CONFIDENCE_THRESHOLD = 0.4;
const NUM_CLASSES = 80;
const NUM_BOXES = 8400;

const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];

export interface Detection {
  label: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number }; // normalisé 0-1
}

export async function loadModel() {
  if (session) return session;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ort = require('onnxruntime-react-native');
  const asset = Asset.fromModule(require('../../assets/models/yolo-realtime.onnx'));
  await asset.downloadAsync();
  session = await ort.InferenceSession.create(asset.localUri || asset.uri);
  console.log('Modèle ONNX chargé:', session.inputNames, session.outputNames);
  return session;
}

/**
 * Réorganise un buffer RGB interleaved (HWC, ce que retourne resize plugin) en CHW attendu par ONNX.
 * Le plugin vision-camera-resize-plugin retourne généralement du HWC — à vérifier selon la version.
 */
function hwcToChw(data: Float32Array, size: number): Float32Array {
  const chw = new Float32Array(3 * size * size);
  const planeSize = size * size;
  for (let i = 0; i < planeSize; i++) {
    chw[i] = data[i * 3]; // R
    chw[planeSize + i] = data[i * 3 + 1]; // G
    chw[2 * planeSize + i] = data[i * 3 + 2]; // B
  }
  return chw;
}

function parseDetections(outputData: Float32Array): Detection[] {
  const detections: Detection[] = [];

  for (let i = 0; i < NUM_BOXES; i++) {
    let maxConf = 0;
    let maxClassIdx = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const conf = outputData[(4 + c) * NUM_BOXES + i];
      if (conf > maxConf) {
        maxConf = conf;
        maxClassIdx = c;
      }
    }
    if (maxConf < CONFIDENCE_THRESHOLD) continue;

    const cx = outputData[0 * NUM_BOXES + i] / 640;
    const cy = outputData[1 * NUM_BOXES + i] / 640;
    const w = outputData[2 * NUM_BOXES + i] / 640;
    const h = outputData[3 * NUM_BOXES + i] / 640;

    detections.push({
      label: COCO_LABELS[maxClassIdx] ?? `classe_${maxClassIdx}`,
      confidence: maxConf,
      box: { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
    });
  }

  return detections.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

/**
 * Prend un buffer déjà redimensionné en 640x640 (depuis vision-camera-resize-plugin) et lance l'inférence.
 */
export async function runInferenceOnTensor(
  resizedBuffer: Float32Array | Uint8Array,
  size = 640
): Promise<Detection[] | null> {
  const s = await loadModel().catch((e) => {
    console.warn('Modèle non chargé', e);
    return null;
  });
  if (!s) return null;

  try {
    const floatData =
      resizedBuffer instanceof Float32Array
        ? resizedBuffer
        : Float32Array.from(resizedBuffer, (v) => v / 255);

    const chwData = hwcToChw(floatData, size);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ort = require('onnxruntime-react-native');
    const inputTensor = new ort.Tensor('float32', chwData, [1, 3, size, size]);

    const inputName = s.inputNames[0];
    const results = await s.run({ [inputName]: inputTensor });
    const outputTensor = results[s.outputNames[0]];

    return parseDetections(outputTensor.data as Float32Array);
  } catch (e: any) {
    console.warn('Erreur inference', e);
    throw e;
  }
}

export default { loadModel, runInferenceOnTensor };