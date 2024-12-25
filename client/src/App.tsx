// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface KeyData {
  ipid: string;
  key: string;
  iv: string;
}

const App: React.FC = () => {
  const [keys, setKeys] = useState<KeyData[]>([]); // Changed to array of KeyData
  const [newKeyData, setNewKeyData] = useState<KeyData>({ ipid: '', key: '', iv: '' });
  const [deleteIpid, setDeleteIpid] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>(''); // For entering admin password

  useEffect(() => {
    if (adminPassword) {
      fetchKeys();
    } else {
      setKeys([]); // Clear keys if no admin password
    }
  }, [adminPassword]);

  const fetchKeys = async () => {
    try {
      const response = await axios.get('/keys', {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      setKeys(response.data); // Directly use the response data
      setError(null);
    } catch (err: any) {
      setError(`Failed to fetch keys: ${err.response?.data?.error || err.message}`);
      setMessage(null);
      setKeys([]); // Clear keys on error
    }
  };

  useEffect(()=>{
    console.log("KEYS", keys)
  }, [keys])

  const handleNewKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewKeyData({ ...newKeyData, [e.target.name]: e.target.value });
  };

  const handleAdminPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminPassword(e.target.value);
  };

  const handleAddKey = async () => {
    if (!adminPassword) {
      setError('Please enter the admin password');
      return;
    }
    try {
      await axios.post('/keys/add', newKeyData, {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      setMessage(`Successfully added IPID: ${newKeyData.ipid}`);
      setError(null);
      setNewKeyData({ ipid: '', key: '', iv: '' });
      fetchKeys(); // Refresh keys list
    } catch (err: any) {
      setError(`Failed to add key: ${err.response?.data?.error || err.message}`);
      setMessage(null);
    }
  };

  const handleDeleteIpidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteIpid(e.target.value);
  };

  const handleDeleteKey = async () => {
    if (!deleteIpid) {
      setError('Please enter the IPID to delete');
      return;
    }
    if (!adminPassword) {
      setError('Please enter the admin password');
      return;
    }
    try {
      await axios.delete(`/keys/delete/${deleteIpid}`, {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      setMessage(`Successfully deleted IPID: ${deleteIpid}`);
      setError(null);
      setDeleteIpid('');
      fetchKeys(); // Refresh keys list
    } catch (err: any) {
      setError(`Failed to delete key: ${err.response?.data?.error || err.message}`);
      setMessage(null);
    }
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '40vw',
      margin: '0 30vw', // Center horizontally
      padding: '20px',
      borderRadius: '5px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', // Center items vertically
      minHeight: '100vh', // Ensure full viewport height
      justifyContent: 'flex-start' // Align content to the top
    }}>
      <div style={{ width: '100%' }}> {/* Add a wrapper to manage content width */}
        <h1>Key Management Service</h1>

        {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

        <section style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <h2>Admin Password</h2>
          <div style={{ display: 'flex', maxWidth: '300px' }}>
            <input
              type="password"
              placeholder="Admin Password"
              value={adminPassword}
              onChange={handleAdminPasswordChange}
              style={{ padding: '8px', borderRadius: '3px', border: '1px solid #ddd', marginRight: '10px' }}
            />
          </div>
        </section>

        <section style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <h2>Configured IPIDs</h2>
          {!adminPassword ? (
            <p>Please enter the admin password to view configured IPIDs.</p>
          ) : keys.length > 0 ? (
            <ul>
              {keys.map((keyData) => (
                <li key={keyData.ipid}>
                  <span>IPID: {keyData.ipid}</span>
                  <br />
                  <span>Key: {keyData.key}</span>
                  <br />
                  <span>IV: {keyData.iv}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No IPIDs configured.</p>
          )}
        </section>

        <section style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <h2>Add Key</h2>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
            <input
              name="ipid"
              placeholder="IPID"
              value={newKeyData.ipid}
              onChange={handleNewKeyChange}
              style={{ marginBottom: '10px', padding: '8px', borderRadius: '3px', border: '1px solid #ddd' }}
            />
            <input
              name="key"
              placeholder="Key"
              value={newKeyData.key}
              onChange={handleNewKeyChange}
              style={{ marginBottom: '10px', padding: '8px', borderRadius: '3px', border: '1px solid #ddd' }}
            />
            <input
              name="iv"
              placeholder="IV"
              value={newKeyData.iv}
              onChange={handleNewKeyChange}
              style={{ marginBottom: '10px', padding: '8px', borderRadius: '3px', border: '1px solid #ddd' }}
            />
            <button onClick={handleAddKey} disabled={!adminPassword} style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
              Add Key
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <h2>Delete Key</h2>
          <div style={{ display: 'flex', alignItems: 'center', maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="IPID to Delete"
              value={deleteIpid}
              onChange={handleDeleteIpidChange}
              style={{ padding: '8px', borderRadius: '3px', border: '1px solid #ddd', marginRight: '10px' }}
            />
            <button onClick={handleDeleteKey} disabled={!adminPassword} style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
              DEL
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default App;