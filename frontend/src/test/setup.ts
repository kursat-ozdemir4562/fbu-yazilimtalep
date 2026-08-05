import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('scrollTo', vi.fn());
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:test');
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

if (!File.prototype.text) {
  File.prototype.text = function text() {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'));
      reader.readAsText(this);
    });
  };
}

if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'));
      reader.readAsArrayBuffer(this);
    });
  };
}
