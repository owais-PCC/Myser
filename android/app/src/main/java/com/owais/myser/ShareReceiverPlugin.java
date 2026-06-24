package com.owais.myser;

import android.content.SharedPreferences;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("myser_share", Context.MODE_PRIVATE);
        String base64 = prefs.getString("pending_share_image", null);
        String mime = prefs.getString("pending_share_mime", "image/jpeg");

        JSObject result = new JSObject();

        if (base64 != null) {
            prefs.edit()
                .remove("pending_share_image")
                .remove("pending_share_mime")
                .apply();

            result.put("base64", base64);
            result.put("mimeType", mime);
        }

        call.resolve(result);
    }
}
