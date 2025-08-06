// TOTP算法实现
class TOTP {
  static generateTOTP(secret, timeStep = 30, digits = 6) {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const key = this.base32Decode(secret);
    const hmac = this.hmacSha1(key, this.intToBytes(time));
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
  }

  static getRemainingSeconds(timeStep = 30) {
    return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
  }

  static base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (let i = 0; i < base32.length; i++) {
      const val = alphabet.indexOf(base32.charAt(i).toUpperCase());
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return new Uint8Array(bytes);
  }

  static hmacSha1(key, data) {
    const blockSize = 64;
    if (key.length > blockSize) {
      key = this.sha1(key);
    }
    const keyPadded = new Uint8Array(blockSize);
    keyPadded.set(key);
    
    const ipad = new Uint8Array(blockSize);
    const opad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      ipad[i] = keyPadded[i] ^ 0x36;
      opad[i] = keyPadded[i] ^ 0x5c;
    }
    
    const innerHash = this.sha1(new Uint8Array([...ipad, ...data]));
    return this.sha1(new Uint8Array([...opad, ...innerHash]));
  }

  static sha1(data) {
    const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    const msg = new Uint8Array(data);
    const msgLen = msg.length;
    const totalLen = msgLen + 9 + (64 - ((msgLen + 9) % 64)) % 64;
    const padded = new Uint8Array(totalLen);
    padded.set(msg);
    padded[msgLen] = 0x80;
    
    const view = new DataView(padded.buffer);
    view.setUint32(totalLen - 4, msgLen * 8, false);
    
    for (let i = 0; i < totalLen; i += 64) {
      const w = new Array(80);
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + j * 4, false);
      }
      for (let j = 16; j < 80; j++) {
        w[j] = this.rotateLeft(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      }
      
      let [a, b, c, d, e] = h;
      for (let j = 0; j < 80; j++) {
        let f, k;
        if (j < 20) {
          f = (b & c) | (~b & d);
          k = 0x5A827999;
        } else if (j < 40) {
          f = b ^ c ^ d;
          k = 0x6ED9EBA1;
        } else if (j < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = 0x8F1BBCDC;
        } else {
          f = b ^ c ^ d;
          k = 0xCA62C1D6;
        }
        
        const temp = (this.rotateLeft(a, 5) + f + e + k + w[j]) & 0xFFFFFFFF;
        e = d;
        d = c;
        c = this.rotateLeft(b, 30);
        b = a;
        a = temp;
      }
      
      h[0] = (h[0] + a) & 0xFFFFFFFF;
      h[1] = (h[1] + b) & 0xFFFFFFFF;
      h[2] = (h[2] + c) & 0xFFFFFFFF;
      h[3] = (h[3] + d) & 0xFFFFFFFF;
      h[4] = (h[4] + e) & 0xFFFFFFFF;
    }
    
    const result = new Uint8Array(20);
    const view2 = new DataView(result.buffer);
    for (let i = 0; i < 5; i++) {
      view2.setUint32(i * 4, h[i], false);
    }
    return result;
  }

  static rotateLeft(n, s) {
    return ((n << s) | (n >>> (32 - s))) & 0xFFFFFFFF;
  }

  static intToBytes(num) {
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = num & 0xff;
      num >>= 8;
    }
    return bytes;
  }
}