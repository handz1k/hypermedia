import { memo } from 'react';
import type { StockState } from '../types.js';
import StockRow from './StockRow.js';

interface Props {
  stocks: StockState[];
}

const StockTable = memo(function StockTable({ stocks }: Props) {
  return (
    <div className="table-wrap">
      <table id="stock-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody id="stocks">
          {stocks.map(stock => (
            <StockRow key={stock.symbol} stock={stock} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default StockTable;
