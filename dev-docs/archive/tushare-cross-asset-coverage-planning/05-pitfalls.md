# 05 Pitfalls

- 2026-02-19: 本地 token 解密失败（`safeStorage.decryptString` 报错）
  - symptom：直接用 `electron` 临时脚本读取 `market_token_main_v2` 后解密失败，报 “Error while decrypting the ciphertext”。
  - root cause：临时脚本运行时应用名与正式进程不一致，导致 keychain 上下文不匹配。
  - what was tried：先按默认 app name 直接解密失败，再改为 `app.setName('@mytrader/backend')` 后重试。
  - fix/workaround：在 `app.whenReady()` 前设置与正式应用一致的 app name，再执行 `safeStorage` 解密。
  - prevention：涉及本地密文 token 实测时，统一复用正式 app identity；脚本模板固定写入该设置。
