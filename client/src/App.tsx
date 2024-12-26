// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import toast, { Toaster } from 'react-hot-toast';

interface KeyData {
  ipid: string;
  key: string;
  iv: string;
}

const App: React.FC = () => {
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [newKeyData, setNewKeyData] = useState<KeyData>({ ipid: '', key: '', iv: '' });
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (adminPassword) {
      fetchKeys();
    } else {
      setKeys([]);
    }
  }, [adminPassword]);

  const fetchKeys = async () => {
    try {
      const response = await axios.get('/keys', {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      setKeys(response.data);
    } catch (err: any) {
      setKeys([]);
    }
  };

  const handleAdminPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminPassword(e.target.value);
  };

  const handleNewKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewKeyData({ ...newKeyData, [e.target.name]: e.target.value });
  };

  const handleAddKey = async () => {
    if (!adminPassword) {
      toast.error('Please enter the admin password');
      return;
    }
    try {
      await axios.post('/keys/add', newKeyData, {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      toast.success(`Successfully added IPID: ${truncateString(newKeyData.ipid, 10)}`);
      setNewKeyData({ ipid: '', key: '', iv: '' });
      setIsAddingNew(false);
      fetchKeys();
    } catch (err: any) {
      toast.error(`Failed to add key: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteKey = async (ipidToDelete: string) => {
    if (!adminPassword) {
      toast.error('Please enter the admin password');
      return;
    }
    try {
      await axios.delete(`/keys/delete/${ipidToDelete}`, {
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      toast.success(`Successfully deleted IPID: ${truncateString(ipidToDelete, 10)}`);
      fetchKeys();
    } catch (err: any) {
      toast.error(`Failed to delete key: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCopyToClipboard = (keyData: KeyData) => {
    const textToCopy = `IPID: ${keyData.ipid}\nKEY: ${keyData.key}\nIV: ${keyData.iv}`;
    navigator.clipboard.writeText(textToCopy);
    toast.success(`Copied data for IPID: ${truncateString(keyData.ipid, 10)} to clipboard.`);
  };

  const truncateString = (str: string, maxLength: number) => {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="font-sans w-[60vw] mx-[20vw] p-5 rounded-md flex flex-col items-center justify-start mt-10">
      <Toaster />
      <div className="w-full">
        <h1 className="text-2xl font-bold mb-4">Key Management</h1>

        <section className="mb-5 pb-4 border-b border-gray-200 flex justify-center items-center">
          <h2 className="text-lg font-semibold mr-5">Admin Password</h2>
          <div className="flex relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Admin Password"
              value={adminPassword}
              onChange={handleAdminPasswordChange}
              className="px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring focus:ring-blue-200 w-full pr-10" // Added pr-10 for icon space
            />
            <button
              type="button"
              onClick={toggleShowPassword}
              className="absolute inset-y-0 right-0 px-3 flex items-center focus:outline-none"
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-gray-500" />
            </button>
          </div>
        </section>

        <section className="mb-5 pb-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Configured IPIDs</h2>
          {!adminPassword ? (
            <p className="text-gray-600">Please enter the admin password to view and manage configured IPIDs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr>
                    <th className="px-4 py-2 border">IPID</th>
                    <th className="px-4 py-2 border">Key</th>
                    <th className="px-4 py-2 border">IV</th>
                    <th className="px-4 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((keyData) => (
                    <tr key={keyData.ipid}>
                      <td className="px-4 py-2 border">{truncateString(keyData.ipid, 20)}</td>
                      <td className="px-4 py-2 border">{truncateString(keyData.key, 20)}</td>
                      <td className="px-4 py-2 border">{truncateString(keyData.iv, 20)}</td>
                      <td className="px-4 py-2 border flex space-x-2">
                        <button
                          onClick={() => handleCopyToClipboard(keyData)}
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleDeleteKey(keyData.ipid)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring focus:ring-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {isAddingNew ? (
                    <tr>
                      <td className="px-4 py-2 border">
                        <input
                          name="ipid"
                          placeholder="IPID"
                          value={newKeyData.ipid}
                          onChange={handleNewKeyChange}
                          className="px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring focus:ring-blue-200 w-full"
                        />
                      </td>
                      <td className="px-4 py-2 border">
                        <input
                          name="key"
                          placeholder="Key"
                          value={newKeyData.key}
                          onChange={handleNewKeyChange}
                          className="px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring focus:ring-blue-200 w-full"
                        />
                      </td>
                      <td className="px-4 py-2 border">
                        <input
                          name="iv"
                          placeholder="IV"
                          value={newKeyData.iv}
                          onChange={handleNewKeyChange}
                          className="px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring focus:ring-blue-200 w-full"
                        />
                      </td>
                      <td className="px-4 py-2 border flex space-x-2">
                        <button
                          onClick={handleAddKey}
                          className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring focus:ring-green-300 mr-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsAddingNew(false)}
                          className="px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring focus:ring-gray-200"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 border text-center">
                        <button
                          onClick={() => setIsAddingNew(true)}
                          disabled={!adminPassword}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add New Key
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;