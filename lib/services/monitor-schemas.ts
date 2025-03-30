export interface MonitorState {
  error?: string;
  success: boolean;
}

export interface MonitorEvent {
  type: 'price' | 'social';
  data: {
    symbol?: string;
    price?: number;
    account?: string;
    content?: string;
  };
}
