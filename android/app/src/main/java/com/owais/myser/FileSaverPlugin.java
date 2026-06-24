package com.owais.myser;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import android.util.Base64;

@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String base64Data = call.getString("data");
        String fileName = call.getString("fileName", "export.zip");
        String mimeType = call.getString("mimeType", "application/zip");

        if (base64Data == null) {
            call.reject("No data provided");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            }

            Uri uri = getContext().getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            );

            if (uri != null) {
                OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                if (os != null) {
                    os.write(bytes);
                    os.close();
                }
                JSObject result = new JSObject();
                result.put("uri", uri.toString());
                result.put("fileName", fileName);
                call.resolve(result);
            } else {
                call.reject("Failed to create file");
            }
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage());
        }
    }
}
