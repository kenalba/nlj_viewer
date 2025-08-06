import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Users, Bell, CheckCircle, AlertCircle, Search, Filter, Star } from 'lucide-react';

// TypeScript interfaces
interface TrainingClass {
  id: number;
  title: string;
  category: string;
  location: string;
  distance: string;
  date: string;
  time: string;
  instructor: string;
  capacity: number;
  enrolled: number;
  waitlist?: number;
  status: 'available' | 'full';
  topics: string[];
}

interface AlternativeClass extends TrainingClass {
  aiScore: number;
  matchReasons: string[];
}

interface Notification {
  id: number;
  type: 'success' | 'info' | 'warning';
  message: string;
}

const TrainingRegistrationSystem = () => {
  const [selectedClass, setSelectedClass] = useState<TrainingClass | null>(null);
  const [registrationStep, setRegistrationStep] = useState<'browse' | 'alternatives' | 'confirm' | 'success'>('browse');
  const [userLocation, setUserLocation] = useState<string>('Downtown Training Center');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Mock data for training classes
  const trainingClasses: TrainingClass[] = [
    {
      id: 1,
      title: 'Advanced Diagnostic Systems',
      category: 'Technical',
      location: 'Downtown Training Center',
      distance: '2.1 miles',
      date: '2025-07-25',
      time: '9:00 AM - 12:00 PM',
      instructor: 'Mike Chen',
      capacity: 15,
      enrolled: 15,
      waitlist: 3,
      status: 'full',
      topics: ['Engine Diagnostics', 'Electronic Systems', 'Troubleshooting']
    },
    {
      id: 2,
      title: 'Customer Service Excellence',
      category: 'Service',
      location: 'Westside Training Hub',
      distance: '5.8 miles',
      date: '2025-07-26',
      time: '1:00 PM - 4:00 PM',
      instructor: 'Sarah Johnson',
      capacity: 20,
      enrolled: 12,
      status: 'available',
      topics: ['Communication Skills', 'Conflict Resolution', 'Sales Techniques']
    },
    {
      id: 3,
      title: 'Hybrid Vehicle Maintenance',
      category: 'Technical',
      location: 'Downtown Training Center',
      distance: '2.1 miles',
      date: '2025-07-28',
      time: '10:00 AM - 1:00 PM',
      instructor: 'Alex Rivera',
      capacity: 12,
      enrolled: 8,
      status: 'available',
      topics: ['Battery Systems', 'Electric Motors', 'Safety Protocols']
    },
    {
      id: 4,
      title: 'Digital Marketing for Dealers',
      category: 'Business',
      location: 'North Campus',
      distance: '12.3 miles',
      date: '2025-07-30',
      time: '9:00 AM - 5:00 PM',
      instructor: 'Jessica Park',
      capacity: 25,
      enrolled: 18,
      status: 'available',
      topics: ['Social Media', 'Online Advertising', 'Analytics']
    }
  ];

  // AI-suggested alternatives when a class is full
  const generateAlternatives = (fullClass: TrainingClass): AlternativeClass[] => {
    const alternatives = trainingClasses
      .filter(cls => cls.id !== fullClass.id && cls.status === 'available')
      .map((cls): AlternativeClass => {
        let score = 0;
        let reasons: string[] = [];

        // Proximity scoring
        if (cls.location === fullClass.location) {
          score += 30;
          reasons.push(`Same location (${cls.location})`);
        } else if (parseFloat(cls.distance) < 5) {
          score += 20;
          reasons.push(`Nearby location (${cls.distance})`);
        }

        // Topic relevance scoring
        const commonTopics = cls.topics.filter(topic => 
          fullClass.topics.some(ft => ft.toLowerCase().includes(topic.toLowerCase()) || 
                                     topic.toLowerCase().includes(ft.toLowerCase()))
        );
        if (commonTopics.length > 0) {
          score += commonTopics.length * 15;
          reasons.push(`Related topics: ${commonTopics.join(', ')}`);
        }

        // Category match
        if (cls.category === fullClass.category) {
          score += 25;
          reasons.push(`Same category (${cls.category})`);
        }

        // Availability bonus (earlier dates get higher scores)
        const daysDiff = Math.abs(new Date(cls.date).getTime() - new Date(fullClass.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 7) {
          score += 10;
          reasons.push(`Similar timing (${Math.round(daysDiff)} days difference)`);
        }

        return { ...cls, aiScore: score, matchReasons: reasons };
      })
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 3);

    return alternatives;
  };

  const handleRegistration = (classInfo: TrainingClass): void => {
    if (classInfo.status === 'full') {
      setSelectedClass(classInfo);
      setRegistrationStep('alternatives');
    } else {
      setSelectedClass(classInfo);
      setRegistrationStep('confirm');
    }
  };

  const confirmRegistration = (): void => {
    setRegistrationStep('success');
    const newNotification: Notification = {
      id: Date.now(),
      type: 'success',
      message: `Successfully registered for "${selectedClass?.title}"`
    };
    setNotifications([...notifications, newNotification]);

    // Simulate instructor notification
    setTimeout(() => {
      const instructorNotification: Notification = {
        id: Date.now() + 1,
        type: 'info',
        message: `Instructor ${selectedClass?.instructor} has been notified of your registration`
      };
      setNotifications(prev => [...prev, instructorNotification]);
    }, 2000);
  };

  const filteredClasses = trainingClasses.filter((cls: TrainingClass) => {
    const matchesSearch = cls.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cls.topics.some((topic: string) => topic.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterCategory === 'all' || cls.category.toLowerCase() === filterCategory.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  if (registrationStep === 'alternatives' && selectedClass) {
    const alternatives = generateAlternatives(selectedClass);
    
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-6">
            <AlertCircle className="text-orange-500 mr-3" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">Class Full - AI Suggestions</h2>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-orange-800">
              <strong>"{selectedClass.title}"</strong> is currently full ({selectedClass.enrolled}/{selectedClass.capacity} enrolled, {selectedClass.waitlist} on waitlist).
            </p>
            <p className="text-orange-700 mt-2">Our AI has found these alternative sessions based on proximity, availability, and relevance:</p>
          </div>

          <div className="space-y-4">
            {alternatives.map((alt, index) => (
              <div key={alt.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center mb-2">
                      <Star className="text-blue-500 mr-2" size={20} />
                      <h3 className="text-lg font-semibold text-gray-800">{alt.title}</h3>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs ml-2">
                        AI Match: {alt.aiScore}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="mr-1" size={16} />
                        {alt.date} at {alt.time}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="mr-1" size={16} />
                        {alt.location} ({alt.distance})
                      </div>
                      <div className="flex items-center">
                        <Users className="mr-1" size={16} />
                        {alt.enrolled}/{alt.capacity} enrolled
                      </div>
                      <div className="text-green-600 font-medium">Available</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClass(alt);
                      setRegistrationStep('confirm');
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Register
                  </button>
                </div>
                
                <div className="bg-gray-50 rounded p-3 mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Why this matches:</p>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    {alt.matchReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setRegistrationStep('browse')}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
            >
              Back to Browse
            </button>
            <button
              onClick={() => {
                const waitlistNotification: Notification = {
                  id: Date.now(),
                  type: 'info',
                  message: `Added to waitlist for "${selectedClass?.title}". You'll be notified if a spot opens.`
                };
                setNotifications([...notifications, waitlistNotification]);
                setRegistrationStep('browse');
              }}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
            >
              Join Original Waitlist
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (registrationStep === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Confirm Registration</h2>
          
          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{selectedClass?.title}</h3>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="mr-2" size={16} />
                {selectedClass?.date} at {selectedClass?.time}
              </div>
              <div className="flex items-center">
                <MapPin className="mr-2" size={16} />
                {selectedClass?.location}
              </div>
              <div className="flex items-center">
                <Users className="mr-2" size={16} />
                Instructor: {selectedClass?.instructor}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-800 mb-2">Automatic Features Enabled:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✓ Email confirmation will be sent immediately</li>
              <li>✓ Calendar reminder 24 hours before class</li>
              <li>✓ SMS reminder 2 hours before class</li>
              <li>✓ Instructor will receive updated roster automatically</li>
              <li>✓ Real-time updates if class details change</li>
            </ul>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setRegistrationStep('browse')}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={confirmRegistration}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Confirm Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (registrationStep === 'success') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Registration Successful!</h2>
          <p className="text-gray-600 mb-6">
            You're now registered for <strong>"{selectedClass?.title}"</strong>
          </p>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-green-800 mb-2">What happens next:</h4>
            <ul className="text-sm text-green-700 text-left space-y-1">
              <li>✓ Confirmation email sent to your inbox</li>
              <li>✓ Event added to your calendar</li>
              <li>✓ Instructor notified of new registration</li>
              <li>✓ Automated reminders scheduled</li>
            </ul>
          </div>

          <button
            onClick={() => setRegistrationStep('browse')}
            className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700"
          >
            Browse More Classes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">AI-Enhanced Training Registration</h1>
            <p className="text-gray-600">Intelligent scheduling and alternative suggestions powered by AI</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <MapPin className="inline mr-1" size={16} />
              Your Location: {userLocation}
            </div>
            {notifications.length > 0 && (
              <div className="relative">
                <Bell className="text-blue-600" size={24} />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search classes or topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="technical">Technical</option>
            <option value="service">Service</option>
            <option value="business">Business</option>
          </select>
        </div>
      </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg flex items-center ${
                  notification.type === 'success' ? 'bg-green-100 text-green-800' :
                  notification.type === 'info' ? 'bg-blue-100 text-blue-800' :
                  'bg-orange-100 text-orange-800'
                }`}
              >
                <CheckCircle className="mr-2" size={16} />
                {notification.message}
                <button
                  onClick={() => setNotifications(notifications.filter((n: Notification) => n.id !== notification.id))}
                  className="ml-auto text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Class Listings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredClasses.map((classInfo: TrainingClass) => (
          <div key={classInfo.id} className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-1">{classInfo.title}</h3>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                  {classInfo.category}
                </span>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                classInfo.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {classInfo.status === 'available' ? 'Available' : 'Full'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="mr-2" size={16} />
                {classInfo.date}
              </div>
              <div className="flex items-center">
                <Clock className="mr-2" size={16} />
                {classInfo.time}
              </div>
              <div className="flex items-center">
                <MapPin className="mr-2" size={16} />
                {classInfo.location}
              </div>
              <div className="flex items-center">
                <Users className="mr-2" size={16} />
                {classInfo.enrolled}/{classInfo.capacity} enrolled
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Instructor:</strong> {classInfo.instructor}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Topics:</strong> {classInfo.topics.join(', ')}
              </p>
            </div>

            <button
              onClick={() => handleRegistration(classInfo)}
              className={`w-full py-2 rounded-lg font-medium transition-colors ${
                classInfo.status === 'available'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {classInfo.status === 'available' ? 'Register Now' : 'View Alternatives'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingRegistrationSystem;