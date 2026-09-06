import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 88,
            height: 100,
            border: '6px solid white',
            borderRadius: 10,
            padding: '14px 12px',
            gap: 12,
          }}
        >
          <div style={{ width: '100%', height: 8, background: 'white', borderRadius: 4 }} />
          <div style={{ width: '100%', height: 8, background: 'white', borderRadius: 4 }} />
          <div style={{ width: '70%', height: 8, background: 'white', borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
