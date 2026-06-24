package com.owais.myser;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.mlkit.vision.text.Text;

@CapacitorPlugin(name = "TextRecognizer")
public class TextRecognizerPlugin extends Plugin {

    @PluginMethod
    public void recognize(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("No image data provided");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);

            if (bitmap == null) {
                call.reject("Could not decode image");
                return;
            }

            // Scale down if too large
            int maxWidth = 1200;
            if (bitmap.getWidth() > maxWidth) {
                float scale = (float) maxWidth / bitmap.getWidth();
                int newHeight = (int) (bitmap.getHeight() * scale);
                bitmap = Bitmap.createScaledBitmap(bitmap, maxWidth, newHeight, true);
            }

            InputImage image = InputImage.fromBitmap(bitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

            recognizer.process(image)
                .addOnSuccessListener(text -> {
                    JSObject result = new JSObject();
                    result.put("text", text.getText());
                    call.resolve(result);
                })
                .addOnFailureListener(e -> {
                    call.reject("OCR failed: " + e.getMessage());
                });

        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }
}
