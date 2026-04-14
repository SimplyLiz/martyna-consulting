import { ImageResponse } from '@vercel/og';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || 'Claritas AI Consulting';
  const description = url.searchParams.get('description') || 'EU AI Act · DSGVO · KI-Governance';

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          background: '#09090f',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        },
        children: [
          // Top: logo
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '16px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '48px',
                      height: '48px',
                      border: '1.5px solid #b8973e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '3px',
                      color: '#b8973e',
                      fontSize: '26px',
                      fontWeight: '600',
                    },
                    children: 'C',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column', gap: '2px' },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: { color: '#f0ece4', fontSize: '20px', fontWeight: '600', letterSpacing: '0.02em' },
                          children: 'Claritas',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: { color: '#b8973e', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' },
                          children: 'AI Consulting',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },

          // Middle: title
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#f0ece4',
                      fontSize: title.length > 30 ? '52px' : '64px',
                      fontWeight: '300',
                      lineHeight: '1.1',
                      letterSpacing: '-0.01em',
                    },
                    children: title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { color: '#8a8070', fontSize: '22px', fontWeight: '300', lineHeight: '1.5', maxWidth: '700px' },
                    children: description,
                  },
                },
              ],
            },
          },

          // Bottom: decorative tag line
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '12px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { width: '32px', height: '1px', background: '#b8973e' },
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { color: '#b8973e', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase' },
                    children: 'claritas-ai-consulting.vercel.app',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  );
}
