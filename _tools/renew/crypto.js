'use strict';
const crypto=require('crypto');
const ALGO='aes-256-gcm';
function keyFromPass(pass){ return crypto.createHash('sha256').update(String(pass)).digest(); }
function keyFromHex(hex){ const k=Buffer.from(hex,'hex'); if(k.length!==32) throw new Error('key must be 32 bytes'); return k; }
function encryptStr(plain,key){ const iv=crypto.randomBytes(12); const c=crypto.createCipheriv(ALGO,key,iv); const enc=Buffer.concat([c.update(plain,'utf8'),c.final()]); const tag=c.getAuthTag();
  return {v:1, iv:iv.toString('hex'), tag:tag.toString('hex'), ct:enc.toString('base64')}; }
function decrypt(cipher,key){ const iv=Buffer.from(cipher.iv,'hex'); const tag=Buffer.from(cipher.tag,'hex'); const ct=Buffer.from(cipher.ct,'base64');
  const d=crypto.createDecipheriv(ALGO,key,iv); d.setAuthTag(tag); const out=Buffer.concat([d.update(ct)]); return out.toString('utf8'); }
function encryptJSON(arr,key){ return encryptStr(JSON.stringify(arr,null,2),key); }
function decryptJSON(cipher,key){ return JSON.parse(decrypt(cipher,key)); }
module.exports={encrypt:encryptStr, decrypt, encryptJSON, decryptJSON, keyFromPass, keyFromHex};
