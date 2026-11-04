"use client";

import { useState } from "react";
import { emi, formatNumber, formatPrice } from "@/lib/format";

export function EmiCalculator({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const loan = price * (1 - down / 100);
  const monthly = emi(loan, rate, years);
  return (
    <div className="emi">
      <p className="emi-result">
        <span className="muted">Estimated EMI</span>
        <strong>₹{formatNumber(Math.round(monthly))}</strong>
        <span className="muted">/month</span>
      </p>
      <label>
        <span>
          Down payment <b>{down}%</b> · {formatPrice(price - loan)}
        </span>
        <input type="range" min={10} max={60} step={5} value={down} onChange={(e) => setDown(+e.target.value)} />
      </label>
      <label>
        <span>
          Interest rate <b>{rate.toFixed(2)}%</b>
        </span>
        <input type="range" min={7} max={12} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} />
      </label>
      <label>
        <span>
          Tenure <b>{years} years</b>
        </span>
        <input type="range" min={5} max={30} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
      </label>
      <p className="hint">Loan amount {formatPrice(loan)}. Indicative only — actual terms depend on the lender.</p>
    </div>
  );
}
