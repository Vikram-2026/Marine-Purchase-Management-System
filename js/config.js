// js/config.js
// Supabase credentials — loaded from localStorage after first setup
const SB_URL = localStorage.getItem('mp_url') || '';
const SB_KEY  = localStorage.getItem('mp_key') || '';

const sb = (SB_URL && SB_KEY)
  ? supabase.createClient(SB_URL, SB_KEY)
  : null;

const CATEGORIES = [
  'Deck Stores','Engine Stores','Provisions','Spare Parts',
  'Chemicals','Safety Equipment','Electrical','Hydraulic',
  'Ropes & Mooring','Navigation','Accommodation','Medical'
];
const CURRENCIES = ['USD','EUR','SGD','GBP','INR','AED','NOK','DKK'];
const PR_STATUSES = ['Pending RFQ','RFQ Issued','Quotes Received','PO Raised','Delivered','Closed'];
const PAYMENT_TERMS = ['Net 30','Net 45','Net 60','Advance','50% Advance + 50% on delivery','LC at Sight'];
const INCOTERMS = ['FOB','CIF','CFR','Ex-Works','DDP','FAS'];

const BADGE_MAP = {
  'Pending RFQ':'b-amber','RFQ Issued':'b-blue','Quotes Received':'b-purple',
  'PO Raised':'b-teal','Delivered':'b-green','Closed':'b-gray',
  'Pending':'b-amber','Acknowledged':'b-blue','Shipped':'b-teal',
  'Cancelled':'b-red','Active':'b-green','Suspended':'b-red',
  'Received':'b-amber','Verified':'b-blue','Approved':'b-purple',
  'Paid':'b-green','Overdue':'b-red',
  'Good':'b-green','Partial':'b-amber','Damaged':'b-red',
  'Normal':'b-gray','Urgent':'b-amber','Critical':'b-red',
  'Confirmed':'b-green','Awarded':'b-green'
};
