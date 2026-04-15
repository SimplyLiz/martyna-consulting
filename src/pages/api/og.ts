import { ImageResponse } from '@vercel/og';

export const prerender = false;

const GOLD = '#d4a84b';
const GOLD_DIM = '#c0983e';
const BG = '#09090f';
const TEXT = '#ffffff';

async function loadCormorant(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;600&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const css = await cssRes.text();
    const match = css.match(/src: url\(([^)]+\.ttf)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || 'Claritas AI Consulting';

  const fontData = await loadCormorant();
  const fonts = fontData
    ? [
        { name: 'Cormorant', data: fontData, weight: 300 as const, style: 'normal' as const },
        { name: 'Cormorant', data: fontData, weight: 600 as const, style: 'normal' as const },
      ]
    : [];
  const serif = fontData ? "'Cormorant', Georgia, serif" : 'Georgia, serif';
  const titleSize = title.length > 35 ? '54px' : '66px';

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'Georgia, serif',
        },
        children: [

          // Logo row
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', marginBottom: '60px' },
              children: [
                // C mark
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '150px',
                      height: '150px',
                      border: `1.5px solid ${GOLD}`,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '48px',
                      flexShrink: 0,
                    },
                    children: {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: serif,
                          fontSize: '93px',
                          fontWeight: 600,
                          color: GOLD,
                          lineHeight: '1',
                        },
                        children: 'C',
                      },
                    },
                  },
                },
                // Wordmark
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontFamily: serif,
                            fontSize: '132px',
                            fontWeight: 300,
                            color: TEXT,
                            letterSpacing: '0.02em',
                            lineHeight: '1',
                          },
                          children: 'Claritas',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '24px',
                            color: GOLD_DIM,
                            letterSpacing: '0.28em',
                            textTransform: 'uppercase',
                            marginTop: '18px',
                          },
                          children: 'AI Consulting',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },

          // Gold rule
          {
            type: 'div',
            props: {
              style: {
                width: '48px',
                height: '1px',
                background: GOLD,
                marginBottom: '36px',
              },
            },
          },

          // Page title
          {
            type: 'div',
            props: {
              style: {
                fontFamily: serif,
                fontSize: titleSize,
                fontWeight: 300,
                color: TEXT,
                lineHeight: '1.2',
                letterSpacing: '-0.01em',
                maxWidth: '980px',
                marginBottom: '24px',
              },
              children: title,
            },
          },

          // Services
          {
            type: 'div',
            props: {
              style: {
                fontSize: '24px',
                color: GOLD,
                letterSpacing: '0.06em',
              },
              children: 'EU AI Act · DSGVO · KI-Governance',
            },
          },

        ],
      },
    },
    { width: 1200, height: 630, fonts }
  );
}
