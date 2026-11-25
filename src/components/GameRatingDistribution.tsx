import { useMemo } from 'react';
import { Star } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface GameRatingDistributionProps {
  averageRating: number;
  totalReviews: number;
  starDistribution: Record<number, number>;
}

interface RatingChartRow {
  star: number;
  label: string;
  count: number;
  pct: number;
  countLabel: string;
  color: string;
}

const STAR_COLORS: Record<number, string> = {
  5: '#10b981',
  4: '#22c55e',
  3: '#f59e0b',
  2: '#f97316',
  1: '#ef4444',
};

function getSentimentSummary(averageRating: number, totalReviews: number): {
  label: string;
  toneClass: string;
} {
  if (totalReviews === 0) {
    return {
      label: 'Awaiting Reviews',
      toneClass: 'text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800',
    };
  }
  if (averageRating >= 4.5) {
    return {
      label: 'Overwhelmingly Positive',
      toneClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15',
    };
  }
  if (averageRating >= 3.8) {
    return {
      label: 'Very Positive',
      toneClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10',
    };
  }
  if (averageRating >= 3.0) {
    return {
      label: 'Mixed Sentiment',
      toneClass: 'text-amber-700 dark:text-amber-300 bg-amber-500/15',
    };
  }
  return {
    label: 'Mostly Negative',
    toneClass: 'text-red-700 dark:text-red-300 bg-red-500/15',
  };
}

function CustomDistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RatingChartRow }>;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="px-3 py-2 rounded-lg bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-700 shadow-lg text-xs">
      <div className="font-semibold text-slate-900 dark:text-white">
        {row.star} {row.star === 1 ? 'Star' : 'Stars'}
      </div>
      <div className="text-slate-600 dark:text-slate-300 font-mono tabular-nums mt-0.5">
        {row.count} {row.count === 1 ? 'review' : 'reviews'} ({row.pct}%)
      </div>
    </div>
  );
}

export function GameRatingDistribution({
  averageRating,
  totalReviews,
  starDistribution,
}: GameRatingDistributionProps) {
  const distributionSum = useMemo(
    () =>
      [1, 2, 3, 4, 5].reduce(
        (sum, star) => sum + (starDistribution[star] || 0),
        0
      ),
    [starDistribution]
  );

  const denominator = distributionSum > 0 ? distributionSum : totalReviews;
  const maxCount = useMemo(
    () =>
      Math.max(
        1,
        ...[1, 2, 3, 4, 5].map((star) => starDistribution[star] || 0)
      ),
    [starDistribution]
  );

  const chartData = useMemo<RatingChartRow[]>(() => {
    return [5, 4, 3, 2, 1].map((star) => {
      const count = starDistribution[star] || 0;
      const pct = denominator > 0 ? Math.round((count / denominator) * 100) : 0;
      return {
        star,
        label: `${star} ★`,
        count,
        pct,
        countLabel: denominator > 0 ? `${count} (${pct}%)` : '0',
        color: STAR_COLORS[star],
      };
    });
  }, [starDistribution, denominator]);

  const sentiment = getSentimentSummary(averageRating, totalReviews);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 items-center">
      <div className="md:col-span-4 text-center md:border-r md:border-slate-200 dark:md:border-slate-800 md:pr-6 space-y-2">
        <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
          {totalReviews > 0 ? averageRating.toFixed(1) : '0.0'}
        </div>
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-4 h-4 ${
                star <= Math.round(averageRating)
                  ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                  : 'text-slate-300 dark:text-slate-700'
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          {totalReviews === 0
            ? 'No player ratings yet'
            : `Based on ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}`}
        </div>
        <div className="pt-0.5">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium ${sentiment.toneClass}`}
          >
            {sentiment.label}
          </span>
        </div>
      </div>

      <div className="md:col-span-8 w-full min-w-0">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 px-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Community Sentiment Breakdown
          </span>
          <span className="font-mono tabular-nums">1–5 Star Distribution</span>
        </div>

        <div className="h-[172px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 64, left: 4, bottom: 4 }}
              barCategoryGap="22%"
            >
              <XAxis type="number" domain={[0, maxCount]} hide />
              <YAxis
                type="category"
                dataKey="label"
                width={38}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                content={<CustomDistributionTooltip />}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 6, 6]}
                barSize={14}
                background={{ fill: 'rgba(148, 163, 184, 0.16)', radius: 6 }}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell key={`star-cell-${entry.star}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="countLabel"
                  position="right"
                  fill="#94a3b8"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
