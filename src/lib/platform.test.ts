import { describe, it, expect, afterEach, vi } from 'vitest';
import { isSamsungBrowser, isIos, isAndroid, isMobileDevice } from './platform';

const UA = {
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadModerne:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

function stubNavigator(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isSamsungBrowser', () => {
  it('reconnaît Samsung Browser', () => {
    stubNavigator(UA.samsung);
    expect(isSamsungBrowser()).toBe(true);
  });

  it('ne confond pas Chrome Android avec Samsung Browser', () => {
    stubNavigator(UA.chromeAndroid);
    expect(isSamsungBrowser()).toBe(false);
  });
});

describe('isIos', () => {
  it('reconnaît Safari sur iPhone', () => {
    stubNavigator(UA.safariIphone);
    expect(isIos()).toBe(true);
  });

  it('reconnaît un iPad moderne, qui s\'annonce en Macintosh tactile', () => {
    stubNavigator(UA.ipadModerne, 5);
    expect(isIos()).toBe(true);
  });

  it('ne prend pas Chrome desktop pour un iPad', () => {
    stubNavigator(UA.chromeDesktop);
    expect(isIos()).toBe(false);
  });
});

describe('isAndroid', () => {
  it('reconnaît Chrome Android et Samsung Browser', () => {
    stubNavigator(UA.chromeAndroid);
    expect(isAndroid()).toBe(true);
    stubNavigator(UA.samsung);
    expect(isAndroid()).toBe(true);
  });

  it('renvoie false sur iPhone', () => {
    stubNavigator(UA.safariIphone);
    expect(isAndroid()).toBe(false);
  });
});

describe('isMobileDevice', () => {
  it('renvoie true sur Samsung Browser, Chrome Android, iPhone et iPad moderne', () => {
    stubNavigator(UA.samsung);
    expect(isMobileDevice()).toBe(true);
    stubNavigator(UA.chromeAndroid);
    expect(isMobileDevice()).toBe(true);
    stubNavigator(UA.safariIphone);
    expect(isMobileDevice()).toBe(true);
    stubNavigator(UA.ipadModerne, 5);
    expect(isMobileDevice()).toBe(true);
  });

  it('renvoie false sur Chrome desktop', () => {
    stubNavigator(UA.chromeDesktop);
    expect(isMobileDevice()).toBe(false);
  });
});
