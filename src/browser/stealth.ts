import type { Page } from 'playwright';
import type { BrowserFingerprint } from './fingerprint.js';

export async function applyStealthPatches(page: Page, fp: BrowserFingerprint): Promise<void> {
  // Fix CDP MouseEvent screenX/screenY bug — injected into ALL frames including
  // cross-origin Turnstile iframes. Chrome 137+ ignores --load-extension for real Chrome,
  // so direct addInitScript injection is the only reliable approach.
  await page.addInitScript(() => {
    const screenX = Math.floor(Math.random() * 400) + 800;
    const screenY = Math.floor(Math.random() * 200) + 400;
    Object.defineProperty(MouseEvent.prototype, 'screenX', { get: () => screenX });
    Object.defineProperty(MouseEvent.prototype, 'screenY', { get: () => screenY });
  });

  await page.addInitScript((fingerprint) => {
    // === Core detection evasion ===

    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Delete webdriver traces
    delete (navigator as any).__proto__.webdriver;

    // Chrome object
    if (!(window as any).chrome) {
      (window as any).chrome = {
        runtime: {
          onMessage: { addListener: () => {}, removeListener: () => {} },
          onConnect: { addListener: () => {}, removeListener: () => {} },
          sendMessage: () => {},
          connect: () => {},
        },
        loadTimes: () => ({
          commitLoadTime: Date.now() / 1000,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
        }),
        csi: () => ({
          onloadT: Date.now(),
          pageT: Date.now(),
          startE: Date.now(),
          tran: 15,
        }),
      };
    }

    // === Navigator properties ===

    Object.defineProperty(navigator, 'languages', { get: () => fingerprint.languages });
    Object.defineProperty(navigator, 'platform', { get: () => fingerprint.platform });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fingerprint.hardwareConcurrency });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fingerprint.deviceMemory });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fingerprint.maxTouchPoints });

    // Connection API
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        Object.defineProperty(conn, 'effectiveType', { get: () => fingerprint.connection.effectiveType });
        Object.defineProperty(conn, 'downlink', { get: () => fingerprint.connection.downlink });
        Object.defineProperty(conn, 'rtt', { get: () => fingerprint.connection.rtt });
      }
    }

    // Plugins - simulate standard Chrome plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        const arr = plugins.map(p => {
          const plugin = Object.create(Plugin.prototype);
          Object.defineProperties(plugin, {
            name: { get: () => p.name },
            filename: { get: () => p.filename },
            description: { get: () => p.description },
            length: { get: () => 1 },
          });
          return plugin;
        });
        Object.setPrototypeOf(arr, PluginArray.prototype);
        Object.defineProperty(arr, 'length', { get: () => arr.length });
        return arr;
      },
    });

    // MimeTypes
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const arr = [
          { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        ];
        Object.setPrototypeOf(arr, MimeTypeArray.prototype);
        return arr;
      },
    });

    // Permissions API
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters: PermissionDescriptor) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'prompt' } as PermissionStatus);
      }
      return originalQuery(parameters);
    };

    // === Screen properties ===

    Object.defineProperty(screen, 'colorDepth', { get: () => fingerprint.screen.colorDepth });
    Object.defineProperty(screen, 'pixelDepth', { get: () => fingerprint.screen.pixelDepth });

    // === WebGL fingerprint ===

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) return fingerprint.webgl.vendor;
      if (parameter === 37446) return fingerprint.webgl.renderer;
      return getParameter.call(this, parameter);
    };

    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) return fingerprint.webgl.vendor;
      if (parameter === 37446) return fingerprint.webgl.renderer;
      return getParameter2.call(this, parameter);
    };

    // === Canvas fingerprint noise ===

    const canvasNoise = fingerprint.canvas.noise;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: any) {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        try {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i] + Math.floor(canvasNoise * 10 * Math.sin(i));
          }
          ctx.putImageData(imageData, 0, 0);
        } catch { /* ignore cross-origin */ }
      }
      return originalToDataURL.call(this, type, quality);
    };

    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string, quality?: any) {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        try {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i] + Math.floor(canvasNoise * 10 * Math.sin(i));
          }
          ctx.putImageData(imageData, 0, 0);
        } catch { /* ignore cross-origin */ }
      }
      return originalToBlob.call(this, callback, type, quality);
    };

    // === AudioContext fingerprint noise ===

    const audioNoise = fingerprint.audio.noise;
    const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function (array: any) {
      origGetFloatFrequencyData.call(this, array);
      for (let i = 0; i < array.length; i++) {
        array[i] = array[i] + audioNoise * Math.sin(i);
      }
    };

    const origCreateOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const osc = origCreateOscillator.call(this);
      const origConnect = osc.connect.bind(osc);
      osc.connect = function (dest: any) {
        return origConnect(dest);
      } as any;
      return osc;
    };

    // === Font enumeration defense ===

    // Override font detection by making measureText slightly inconsistent
    const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function (text: string) {
      const result = originalMeasureText.call(this, text);
      const noise = canvasNoise * 0.1;
      Object.defineProperty(result, 'width', {
        get: () => originalMeasureText.call(this, text).width + noise,
      });
      return result;
    };

    // === WebRTC IP leak prevention ===

    const origRTCPeerConnection = window.RTCPeerConnection;
    if (origRTCPeerConnection) {
      (window as any).RTCPeerConnection = function (config: any) {
        if (config && config.iceServers) {
          config.iceServers = [];
        }
        return new origRTCPeerConnection(config);
      } as any;
      (window as any).RTCPeerConnection.prototype = origRTCPeerConnection.prototype;
    }

    // === Iframe contentWindow ===

    try {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function () {
          return new Proxy(this.contentWindow || window, {
            get: (target, prop) => {
              if (prop === 'chrome') return (window as any).chrome;
              return (target as any)[prop];
            },
          });
        },
      });
    } catch { /* may fail, ok */ }

  }, fp);
}

export function getStealthLaunchArgs(): string[] {
  return [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--no-service-autorun',
    '--password-store=basic',
  ];
}

