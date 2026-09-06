import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 16,
            height: 18,
            border: '1.5px solid white',
            borderRadius: 2,
            padding: '3px 2px',
            gap: 2,
          }}
        >
          <div style={{ width: '100%', height: 1.5, background: 'white', borderRadius: 1 }} />
          <div style={{ width: '100%', height: 1.5, background: 'white', borderRadius: 1 }} />
          <div style={{ width: '70%', height: 1.5, background: 'white', borderRadius: 1 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
