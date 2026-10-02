package com.safevault.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SafeVaultUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
