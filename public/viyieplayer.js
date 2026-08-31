class ViyiePlayer {
  constructor(options) {
    this.container = typeof options.container === 'string' 
      ? document.querySelector(options.container) 
      : options.container;
      
    if (!this.container) {
      console.error('ViyiePlayer: container not found');
      return;
    }

    this.videoId = options.videoId || '';
    
    if (!this.videoId) {
      console.error('ViyiePlayer: videoId is required');
      return;
    }

    // Attempt to automatically detect the base URL from where this script was loaded
    let baseUrl = '/';
    try {
      const scriptTag = document.currentScript;
      if (scriptTag && scriptTag.src) {
        const urlObj = new URL(scriptTag.src);
        baseUrl = urlObj.origin + '/';
      } else {
        // Fallback for some browsers
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
          if (scripts[i].src.includes('viyieplayer.js')) {
            const urlObj = new URL(scripts[i].src);
            baseUrl = urlObj.origin + '/';
            break;
          }
        }
      }
    } catch (e) {
      console.warn('ViyiePlayer: Could not auto-detect base URL', e);
    }
    
    // Allow overriding base URL
    if (options.baseUrl) {
      baseUrl = options.baseUrl;
      if (!baseUrl.endsWith('/')) baseUrl += '/';
    }

    let iframeSrc = `${baseUrl}embed/${this.videoId}`;

    this.iframe = document.createElement('iframe');
    this.iframe.src = iframeSrc;
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.allowFullscreen = true;
    this.iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture');
    
    this.container.appendChild(this.iframe);
  }
  
  destroy() {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
  }
}
window.ViyiePlayer = ViyiePlayer;
