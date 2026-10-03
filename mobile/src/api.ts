import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
export const SITE = (process.env.EXPO_PUBLIC_API_URL || 'https://okirika-shop.vercel.app').replace(/\/$/, '');
let memoryToken: string | null = null;
export const storage = {
  get: async (key: string) => Platform.OS === 'web' ? (key === 'session' ? memoryToken : null) : SecureStore.getItemAsync('okirika.' + key),
  set: async (key: string, value: string) => { if (Platform.OS === 'web') { if(key === 'session') memoryToken=value; } else await SecureStore.setItemAsync('okirika.' + key,value); },
  remove: async (key: string) => { if (Platform.OS === 'web') memoryToken=null; else await SecureStore.deleteItemAsync('okirika.' + key); },
};
export async function api(path: string, token?: string | null, body?: unknown, method = 'GET') {
  const response = await fetch(SITE + '/api' + path, {method, headers:{...(body !== undefined ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:'Bearer '+token} : {})}, ...(body !== undefined ? {body:JSON.stringify(body)} : {}), credentials:'omit'});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'The shop could not be reached. Please try again.');
  return data;
}
export type Product = {id:string;name:string;category:string;description:string;price:number;image:string;position:string;active?:boolean};
export type Item = Product & {quantity:number};
export type User = {id:string;name:string;email:string};
export const money = (n:number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n/100);
