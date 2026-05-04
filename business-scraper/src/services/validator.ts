export class Validator {
  static isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }

  static isValidInstagram(instagram: string): boolean {
    if (!instagram) return false;
    const cleaned = instagram.replace('@', '').trim();
    return cleaned.length >= 3 && cleaned.length <= 30 && /^[a-z0-9_.-]+$/i.test(cleaned);
  }

  static isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
      const formatted = url.startsWith('http') ? url : `https://${url}`;
      new URL(formatted);
      return true;
    } catch {
      return false;
    }
  }

  static isValidBusinessName(name: string): boolean {
    if (!name) return false;
    return name.trim().length >= 3 && name.length <= 100;
  }

  static isValidAddress(address: string): boolean {
    if (!address) return false;
    return address.trim().length >= 5;
  }

  static isLeadComplete(lead: {
    nombreLocal: string;
    ciudad: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    instagram?: string;
  }): boolean {
    if (!this.isValidBusinessName(lead.nombreLocal) || !lead.ciudad) return false;
    const hasContact =
      (lead.email && this.isValidEmail(lead.email)) ||
      (lead.telefono && this.isValidPhone(lead.telefono)) ||
      (lead.instagram && this.isValidInstagram(lead.instagram));
    return !!hasContact;
  }

  static isSuspicious(lead: { nombreLocal: string; email?: string }): boolean {
    const name = lead.nombreLocal.toLowerCase();
    const suspiciousPatterns = [/test/i, /spam/i, /fake/i, /example/i, /demo/i];
    if (suspiciousPatterns.some(p => p.test(name))) return true;
    if (lead.email) {
      const suspiciousEmails = ['test@', 'spam@', 'fake@', 'noreply@'];
      if (suspiciousEmails.some(p => lead.email?.includes(p))) return true;
    }
    return false;
  }
}
