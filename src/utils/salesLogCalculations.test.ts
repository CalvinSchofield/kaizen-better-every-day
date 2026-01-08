import { describe, it, expect } from 'vitest';
import { calculateFromSalesLog } from './salesLogCalculations';

describe('calculateFromSalesLog', () => {
  describe('empty/invalid inputs', () => {
    it('returns zeros for null input', () => {
      expect(calculateFromSalesLog(null as any)).toEqual({ fp: 0, prmr: 0 });
    });

    it('returns zeros for undefined input', () => {
      expect(calculateFromSalesLog(undefined as any)).toEqual({ fp: 0, prmr: 0 });
    });

    it('returns zeros for empty array', () => {
      expect(calculateFromSalesLog([])).toEqual({ fp: 0, prmr: 0 });
    });

    it('returns zeros for non-array input', () => {
      expect(calculateFromSalesLog({} as any)).toEqual({ fp: 0, prmr: 0 });
      expect(calculateFromSalesLog('string' as any)).toEqual({ fp: 0, prmr: 0 });
    });
  });

  describe('FP sales', () => {
    it('counts 1 FP for each fp-type sale', () => {
      const salesLog = [
        { type: 'fp', prmr: 50 },
        { type: 'fp', prmr: 75 },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 2, prmr: 125 });
    });

    it('handles fp sale with zero prmr', () => {
      const salesLog = [{ type: 'fp', prmr: 0 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: 0 });
    });

    it('handles fp sale with missing prmr', () => {
      const salesLog = [{ type: 'fp' }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: 0 });
    });
  });

  describe('upgrade sales', () => {
    it('calculates upgrade FP as prmr/85', () => {
      const salesLog = [{ type: 'upgrade', prmr: 85 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: 85 });
    });

    it('handles partial upgrade FP correctly', () => {
      const salesLog = [{ type: 'upgrade', prmr: 42.5 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0.5, prmr: 42.5 });
    });

    it('handles upgrade with zero prmr', () => {
      const salesLog = [{ type: 'upgrade', prmr: 0 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0, prmr: 0 });
    });

    it('handles upgrade with missing prmr', () => {
      const salesLog = [{ type: 'upgrade' }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0, prmr: 0 });
    });
  });

  describe('mixed sales', () => {
    it('correctly combines fp and upgrade sales', () => {
      const salesLog = [
        { type: 'fp', prmr: 50 },
        { type: 'upgrade', prmr: 85 },
        { type: 'fp', prmr: 75 },
      ];
      // FP: 1 + 1 + 1 = 3 (2 fp sales + 1 upgrade at 85/85)
      // PRMR: 50 + 85 + 75 = 210
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 3, prmr: 210 });
    });
  });

  describe('never_installed status', () => {
    it('excludes sales with never_installed status', () => {
      const salesLog = [
        { type: 'fp', prmr: 50 },
        { type: 'fp', prmr: 100, install_status: 'never_installed' },
        { type: 'fp', prmr: 75 },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 2, prmr: 125 });
    });

    it('excludes upgrade sales with never_installed status', () => {
      const salesLog = [
        { type: 'upgrade', prmr: 85, install_status: 'never_installed' },
        { type: 'upgrade', prmr: 170 },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 2, prmr: 170 });
    });

    it('includes sales with other install statuses', () => {
      const salesLog = [
        { type: 'fp', prmr: 50, install_status: 'installed' },
        { type: 'fp', prmr: 75, install_status: 'pending' },
        { type: 'fp', prmr: 25, install_status: null },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 3, prmr: 150 });
    });

    it('returns zeros when all sales are never_installed', () => {
      const salesLog = [
        { type: 'fp', prmr: 50, install_status: 'never_installed' },
        { type: 'upgrade', prmr: 85, install_status: 'never_installed' },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0, prmr: 0 });
    });
  });

  describe('prmr value handling', () => {
    it('handles string prmr values', () => {
      const salesLog = [{ type: 'fp', prmr: '50' }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: 50 });
    });

    it('handles invalid prmr values as zero', () => {
      const salesLog = [
        { type: 'fp', prmr: 'invalid' },
        { type: 'fp', prmr: NaN },
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 2, prmr: 0 });
    });

    it('handles negative prmr (edge case)', () => {
      const salesLog = [{ type: 'fp', prmr: -50 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: -50 });
    });
  });

  describe('unknown sale types', () => {
    it('counts prmr but not fp for unknown types', () => {
      const salesLog = [
        { type: 'unknown', prmr: 100 },
        { type: '', prmr: 50 },
      ];
      // Unknown types add to PRMR but not FP
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0, prmr: 150 });
    });

    it('handles sales with missing type', () => {
      const salesLog = [{ prmr: 100 }];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 0, prmr: 100 });
    });
  });

  describe('real-world scenarios', () => {
    it('handles a typical day with mixed sales', () => {
      const salesLog = [
        { type: 'fp', prmr: 45, install_status: 'installed', customer_name: 'John' },
        { type: 'fp', prmr: 65, install_status: 'pending', customer_name: 'Jane' },
        { type: 'upgrade', prmr: 35, install_status: 'installed', customer_name: 'Bob' },
        { type: 'fp', prmr: 55, install_status: 'never_installed', customer_name: 'Alice' },
      ];
      // FP: 1 + 1 + (35/85) = 2.41...
      // PRMR: 45 + 65 + 35 = 145 (Alice excluded)
      const result = calculateFromSalesLog(salesLog);
      expect(result.fp).toBeCloseTo(2.41, 1);
      expect(result.prmr).toBe(145);
    });

    it('matches Kobe scenario from bug report ($35 PRMR fp sale)', () => {
      const salesLog = [
        {
          account_number: '22199908',
          customer_address: '3392 Windmill Way',
          prmr: 35,
          type: 'fp',
          timestamp: '2026-01-08T22:39:16.687Z'
        }
      ];
      expect(calculateFromSalesLog(salesLog)).toEqual({ fp: 1, prmr: 35 });
    });
  });
});
