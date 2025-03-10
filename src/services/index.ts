import {LiveApiService} from './LiveApiService';
import {API_KEY, API_URI} from '../constants';

export * from './LiveApiService';

export const liveApiService = new LiveApiService({ url: API_URI, apiKey: API_KEY})
