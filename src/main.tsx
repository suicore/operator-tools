import React from "react";
import ReactDOM from "react-dom/client";
import "@radix-ui/themes/styles.css";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { Theme } from "@radix-ui/themes";
import App from "./App.tsx";
import { dAppKit } from "./dAppKit.ts";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<Theme appearance="dark" accentColor="teal" grayColor="slate" radius="large">
			<DAppKitProvider dAppKit={dAppKit}>
				<App />
			</DAppKitProvider>
		</Theme>
	</React.StrictMode>,
);
