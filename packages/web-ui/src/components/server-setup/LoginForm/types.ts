export interface LoginFormBodyProps {
  url: string;
  onUrlChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  isConnecting: boolean;
  locationError: string | null;
  connectError: string | null;
}
