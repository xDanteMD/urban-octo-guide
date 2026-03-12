import { useState, useEffect, useCallback } from 'react';

export function useStoreValue(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.electronAPI.storeGet(key, defaultValue).then((v) => {
      setValue(v);
      setLoaded(true);
    });
  }, [key]);

  const set = useCallback((newVal) => {
    setValue(newVal);
    window.electronAPI.storeSet(key, newVal);
  }, [key]);

  return [value, set, loaded];
}

export function useApiKeys() {
  const [anthropicKey, setAnthropicKey] = useStoreValue('apiKey_anthropic', '');
  const [geminiKey, setGeminiKey] = useStoreValue('apiKey_gemini', '');
  const [deepseekKey, setDeepseekKey] = useStoreValue('apiKey_deepseek', '');

  const clearAll = useCallback(() => {
    setAnthropicKey('');
    setGeminiKey('');
    setDeepseekKey('');
    window.electronAPI.storeDelete('apiKey_anthropic');
    window.electronAPI.storeDelete('apiKey_gemini');
    window.electronAPI.storeDelete('apiKey_deepseek');
  }, []);

  const getKeyForProvider = useCallback((provider) => {
    if (provider === 'anthropic') return anthropicKey;
    if (provider === 'gemini') return geminiKey;
    if (provider === 'deepseek') return deepseekKey;
    return '';
  }, [anthropicKey, geminiKey, deepseekKey]);

  return {
    anthropicKey, setAnthropicKey,
    geminiKey, setGeminiKey,
    deepseekKey, setDeepseekKey,
    clearAll,
    getKeyForProvider,
  };
}
