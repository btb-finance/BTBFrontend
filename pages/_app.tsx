import Layout from "../components/layout";
import "../styles/globals.css";
import type { AppProps } from "next/app"; // Import the type for AppProps

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}