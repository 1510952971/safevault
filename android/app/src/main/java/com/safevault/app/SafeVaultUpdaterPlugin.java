package com.safevault.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "SafeVaultUpdater")
public class SafeVaultUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void installApk(PluginCall call) {
        String downloadUrl = call.getString("url");
        String requestedName = call.getString("fileName", "SafeVault-update.apk");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("没有可用的 Android APK 下载地址");
            return;
        }

        String safeName = requestedName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.toLowerCase().endsWith(".apk")) safeName += ".apk";
        final String apkFileName = safeName;

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "SafeVault-Android-Updater");
                connection.connect();
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("下载失败 HTTP " + status);
                }

                final File apk = new File(getContext().getCacheDir(), apkFileName);
                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                }

                getActivity().runOnUiThread(() -> openInstaller(call, apk));
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject("APK 下载失败：" + error.getMessage()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private void openInstaller(PluginCall call, File apk) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !context.getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + context.getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            call.reject("请在系统设置中允许 SafeVault 安装未知应用后，再点击更新");
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apk
        );
        Intent installer = new Intent(Intent.ACTION_VIEW);
        installer.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(installer);

        JSObject result = new JSObject();
        result.put("started", true);
        result.put("message", "已下载 APK，正在打开系统安装确认");
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
