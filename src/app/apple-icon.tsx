import { ImageResponse } from "next/og";
import { GridMark, LOGO_BG } from "./logoMark";

// Apple touch icon — the grid mark on the dark tile, generated at build (next/og).
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <GridMark box={180} />
      </div>
    ),
    { ...size },
  );
}
