import { ImageResponse } from "next/og";
import { GridMark, LOGO_BG } from "./logoMark";

// Share / OG image (Twitter, iMessage, Discord, …) — the grid mark centred on the
// dark tile. Text-free brand mark. Generated at build (next/og), 1200×630.
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
          background: `radial-gradient(circle at 50% 44%, #14161a, ${LOGO_BG} 70%)`,
        }}
      >
        <GridMark box={520} />
      </div>
    ),
    { ...size },
  );
}
