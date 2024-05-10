// IE8, IE9

export interface XDomainRequest {
  new (): XDomainRequest;
  timeout: number;
  onload: () => void;
  onerror: () => void;
  onprogress: () => void;
  ontimeout: () => void;
  responseType: string;
  responseText: string;
  open(method: string, url: string): void;
  send(data?: Document | XMLHttpRequestBodyInit | null): void;
}
