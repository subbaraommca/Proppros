/**
 * Camera / library photos (DESIGN_GUIDELINES §10.6): permission asked at the moment of use,
 * long edge downscaled to 1600px, JPEG 0.7, then uploaded as multipart form data.
 */
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

export interface Photo {
  uri: string;
  name: string;
}

export async function pickPhoto(source: "camera" | "library"): Promise<Photo | null> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      source === "camera" ? "Camera access is off" : "Photo access is off",
      "Turn it on for Proppros in Settings to attach photos.",
      [{ text: "Not now", style: "cancel" }, ...(Platform.OS !== "web" ? [{ text: "Open Settings", onPress: () => Linking.openSettings() }] : [])],
    );
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  const resize = longEdge > 1600 ? [{ resize: (asset.width ?? 0) >= (asset.height ?? 0) ? { width: 1600 } : { height: 1600 } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, resize, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: out.uri, name: `photo-${Date.now()}.jpg` };
}

/** Append a photo to FormData (React Native wants {uri,name,type}; the web build needs a real Blob). */
export async function appendPhoto(form: FormData, field: string, photo: Photo) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    form.append(field, blob, photo.name);
  } else {
    form.append(field, { uri: photo.uri, name: photo.name, type: "image/jpeg" } as unknown as Blob);
  }
}
