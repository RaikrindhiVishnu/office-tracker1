export interface Session {
  checkIn: any;
  checkOut?: any;
}

export interface Employee {
 id: string; 
  uid: string;
  name: string;
  email: string;
  role?: string;
  status?: "ONLINE" | "OFFLINE";
  totalMinutes?: number;
  designation?: string;
  accountType?: string;
  salary?: number;
  lastUpdated?: any;
  sessions?: Session[];
  profilePhoto?: string;
}
