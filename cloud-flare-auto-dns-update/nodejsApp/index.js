const axios = require('axios');
const moment = require('moment');
const options = require("/data/options");

const ZONE_ID = options.zoneId,
    API_KEY = options.apiKey,
    API_EMAIL = options.apiEmail,
    CLOUDFALRE_URL = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`;

const CLOUDFLARE_HEADERS = {
    'X-Auth-Key': API_KEY,
    'X-Auth-Email': API_EMAIL
};

const getPublicIP = async () => {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
};

const getCloudflareDNSRecords = async () => {
    const response = await axios.get(CLOUDFALRE_URL, { headers: CLOUDFLARE_HEADERS });
    return (response.data.result || []).filter(dns => dns.type === 'A')
        .filter(dns => !dns.name.startsWith('klm'));
}

const updateCloudfalreDNSRecords = async (dnsRecords = [], publicIP) => {
    await Promise.all(dnsRecords.map(async dns => {
        logging(`Starting update IP DNS record ${dns.name} to ${publicIP}`);
        await axios.put(`${CLOUDFALRE_URL}/${dns.id}`, { content: publicIP, name: dns.name, type: 'A', proxied: true }, { headers: CLOUDFLARE_HEADERS });
    }));
}

const execUpdateCloudflareIP = async () => {
    try {
        const dnsRecords = await getCloudflareDNSRecords();
        const currentPublicIP = await getPublicIP();
        const firstDNSIp = dnsRecords[0].content;

        if (firstDNSIp !== currentPublicIP) {
            await updateCloudfalreDNSRecords(dnsRecords, currentPublicIP);
        } else {
            logging(`Skip update Cloudflare DNS record because of it still the same: ${currentPublicIP}`);
        }
    } catch (error) {
        console.error('Error while execUpdateCloudflareIP', error);
    }
}

const logging = (message) => {
    console.log(`[${moment().format('YYYY-MM-DD HH:mm:SS')}] ${message}`);
}

const exec = () => new Promise(async (resolve, reject) => {
    await execUpdateCloudflareIP();
    setInterval(async () => await execUpdateCloudflareIP(), 300000);
});

exec().then(console.log).catch(console.error);