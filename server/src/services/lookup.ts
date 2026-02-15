import { lookup as whoisLookup } from "whois";
import * as dns from "dns/promises";

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
  private promisifyWhois(domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
      whoisLookup(domain, (err: Error | null, data: string | any) => {
        if (err) reject(err);
        else resolve(typeof data === "string" ? data : JSON.stringify(data));
      });
    });
  }
  async getIP(domain: string): Promise<string | null> {
    try {
      const result = await dns.lookup(domain);
      return result.address;
    } catch {
      return null;
    }
  }

  private parseWhoisDate(dateStr: string | null | undefined): Date | undefined {
    if (!dateStr) return undefined;
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private extractWhoisField(
    whoisResponse: string,
    fieldNames: string[],
  ): string | null {
    const lines = whoisResponse.split("\n");
    for (const line of lines) {
      for (const fieldName of fieldNames) {
        const regex = new RegExp(`^${fieldName}\\s*:?\\s*(.+)$`, "im");
        const match = line.match(regex);
        if (match) {
          return match[1].trim();
        }
      }
    }
    return null;
  }

  async getDomainRegistrationInfo(
    domain: string,
  ): Promise<DomainRegistrationInfo> {
    try {
      const whoisResponse = await this.promisifyWhois(domain);

      // Extract creation date from various field names
      const createdRaw = this.extractWhoisField(whoisResponse, [
        "Creation Date",
        "Created Date",
        "created",
        "registered",
        "Registration Time",
      ]);

      // Extract expiry date from various field names
      const expiresRaw = this.extractWhoisField(whoisResponse, [
        "Registry Expiry Date",
        "Expiry Date",
        "Expiration Date",
        "expires",
        "Expire Date",
      ]);

      // Extract registrar
      const registrar = this.extractWhoisField(whoisResponse, [
        "Registrar",
        "Sponsoring Registrar",
      ]);

      const created = this.parseWhoisDate(createdRaw);
      const expires = this.parseWhoisDate(expiresRaw);

      let ageDays: number | undefined = undefined;
      let isNewDomain = true;

      if (created && !isNaN(created.getTime())) {
        ageDays = Math.floor(
          (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24),
        );
        isNewDomain = ageDays < 30;
      }

      const ip = await this.getIP(domain);

      return {
        domain,
        ip: ip || undefined,
        createdDate: created,
        expiresDate: expires,
        registrar: registrar || undefined,
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
