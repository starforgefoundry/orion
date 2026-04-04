interface Printer {
  name: string;
  type: 'cloud' | 'local';
}

interface CloudPrinter extends Printer {
  dev_id: string;
}

interface LocalPrinter extends Printer {
  local_ip: string;
  serial: string;
  access_code: string;
}
