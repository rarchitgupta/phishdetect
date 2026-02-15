import whois from "whois-json";
import dns from "dns/promises";

export interface DomainRegistrationInfo {
  domain: string;
  ip?: string;
  createdDate?: Date;
  expiresDate?: Date;
  registrar?: string;
  ageDays?: number;
  isNewDomain: boolean;
}

export class LookupService {

  async getIP(domain: string): Promise<string | null> {
    try {
      const result = await dns.lookup(domain);
      return result.address;
    } catch {
      return null;
    }
  }

  async getDomainRegistrationInfo(domain: string): Promise<DomainRegistrationInfo> {
    try {
      const whoisResult = await whois(domain);

      const createdRaw =
        whoisResult.creationDate ||
        whoisResult.createdDate ||
        whoisResult.created ||
        whoisResult.registered;

      const expiresRaw =
        whoisResult.registryExpiryDate ||
        whoisResult.expiryDate ||
        whoisResult.expires;

      const created = createdRaw ? new Date(createdRaw) : undefined;
      const expires = expiresRaw ? new Date(expiresRaw) : undefined;

      let ageDays: number | undefined = undefined;
      let isNewDomain = true;

      if (created && !isNaN(created.getTime())) {
        ageDays = Math.floor(
          (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
        );
        isNewDomain = ageDays < 30;
      }

      const ip = await this.getIP(domain);

      return {
        domain,
        ip: ip || undefined,
        createdDate: created,
        expiresDate: expires,
        registrar: whoisResult.registrar,
        ageDays,
        isNewDomain,
      };

    } catch (err) {
      return {
        domain,
        isNewDomain: true,
      };
    }
  }

}
