import { ImageResponse } from "next/og";
import { LOGO_DATA_URI, LOGO_BG } from "./logoMark";

// Share / OG image (Twitter, iMessage, Discord, …) — the engine-style grid mark
// centred on the dark tile. Text-free. Rasterised at build (next/og), 1200×630.
export const dynamic = "force-static";
export const alt = "akaCOVART — generative album-art studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: LOGO_BG,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} width={552} height={552} alt="" />
      </div>
    ),
    { ...size },
  );
}
