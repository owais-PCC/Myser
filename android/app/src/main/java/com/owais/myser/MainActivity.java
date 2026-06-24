package com.owais.myser;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;

import com.getcapacitor.BridgeActivity;

import java.io.InputStream;
import java.io.ByteArrayOutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareReceiverPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(TextRecognizerPlugin.class);
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("image/")) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) {
                try {
                    InputStream inputStream = getContentResolver().openInputStream(uri);
                    if (inputStream != null) {
                        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                        byte[] data = new byte[4096];
                        int bytesRead;
                        while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
                            buffer.write(data, 0, bytesRead);
                        }
                        inputStream.close();
                        String base64 = Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP);
                        String mimeType = getContentResolver().getType(uri);
                        if (mimeType == null) mimeType = "image/jpeg";

                        getSharedPreferences("myser_share", MODE_PRIVATE)
                            .edit()
                            .putString("pending_share_image", base64)
                            .putString("pending_share_mime", mimeType)
                            .apply();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
}
