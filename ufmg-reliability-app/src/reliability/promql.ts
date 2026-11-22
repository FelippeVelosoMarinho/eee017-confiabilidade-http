export interface QueryFilters {
  serverAddress?: string;
  httpRoute?: string;
}

function labelMatcher(filters: QueryFilters, extra = ''): string {
  const parts: string[] = [];
  if (filters.serverAddress && filters.serverAddress !== 'All' && filters.serverAddress !== '$__all') {
    parts.push(`server_address=~"${filters.serverAddress}"`);
  }
  if (filters.httpRoute && filters.httpRoute !== 'All' && filters.httpRoute !== '$__all') {
    parts.push(`http_route=~"${filters.httpRoute}"`);
  }
  if (extra) {
    parts.push(extra);
  }
  return parts.length ? `{${parts.join(',')}}` : '';
}

export function queryTotal(window: string, filters: QueryFilters): string {
  const m = labelMatcher(filters);
  return `sum(increase(http_server_request_duration_seconds_count${m}[${window}]))`;
}

export function queryErrors(window: string, filters: QueryFilters): string {
  const m = labelMatcher(filters, 'http_response_status_code=~"5.."');
  return `sum(increase(http_server_request_duration_seconds_count${m}[${window}]))`;
}

export function queryBucket(window: string, filters: QueryFilters): string {
  const m = labelMatcher(filters);
  return `sum by (le) (increase(http_server_request_duration_seconds_bucket${m}[${window}]))`;
}

export function queryHistogramQuantile(q: number, window: string, filters: QueryFilters): string {
  const m = labelMatcher(filters);
  return `histogram_quantile(${q}, sum by (le, server_address) (rate(http_server_request_duration_seconds_bucket${m}[${window}])))`;
}
