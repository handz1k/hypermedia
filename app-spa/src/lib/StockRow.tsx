import { memo } from 'react';
import type { StockState } from '../types.js';

interface Props {
  stock: StockState;
}

const StockRow = memo(function StockRow({ stock }: Props) {
  const dir            = stock.change >= 0 ? 'up' : 'down';
  const priceFormatted = stock.price.toFixed(2);
  const changeFormatted = (stock.change >= 0 ? '+' : '') +
                          (stock.change * 100).toFixed(2) + '%';
  const volumeFormatted = stock.volume.toLocaleString('en-US');

  return (
    <tr id={`row-${stock.symbol}`} className={`flash-${dir}`}>
      <td className="symbol">{stock.symbol}</td>
      <td className={`price ${dir}`}>{priceFormatted}</td>
      <td className={`change ${dir}`}>{changeFormatted}</td>
      <td className="volume">{volumeFormatted}</td>
    </tr>
  );
});

export default StockRow;
