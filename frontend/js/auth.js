window.OneSpaceAuth = window.OneSpaceAuth || {};

const ONE_SPACE_AUTH_KEY = "onespace_auth";

window.OneSpaceAuth.register = async function (data) {
  if (window.OneSpaceConfig.USE_MOCK_DATA) {
    if (window.OneSpaceMockData) {
      window.OneSpaceMockData.seed();
    }

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    const confirmPassword = String(data.confirmPassword || "");

    if (!name || !email || !password || !confirmPassword) {
      throw new Error("All fields are required.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    let users = [];
    try {
      users = JSON.parse(window.localStorage.getItem("onespace_users") || "[]");
    } catch (error) {
      users = [];
    }

    if (users.some(function (user) {
      return user.email.toLowerCase() === email;
    })) {
      throw new Error("An account with this email already exists.");
    }

    const user = {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      email,
      password
    };
    users.push(user);
    window.localStorage.setItem("onespace_users", JSON.stringify(users));
    return {
      success: true,
      user: { id: user.id, name: user.name, email: user.email }
    };
  }

  // Real mode: call backend
  const response = await requestJson("/api/auth/register/", "POST", {
    name: data.name,
    email: data.email,
    password: data.password
  });
  return response;
};

window.OneSpaceAuth.login = async function (identifier, password) {
  if (window.OneSpaceConfig.USE_MOCK_DATA) {
    if (window.OneSpaceMockData) {
      window.OneSpaceMockData.seed();
    }

    const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");
    if (!normalizedIdentifier || !normalizedPassword) {
      throw new Error("Enter your email or username and password.");
    }

    let users = [];
    try {
      users = JSON.parse(window.localStorage.getItem("onespace_users") || "[]");
    } catch (error) {
      users = [];
    }

    const user = users.find(function (candidate) {
      return candidate.email.toLowerCase() === normalizedIdentifier || candidate.name.toLowerCase() === normalizedIdentifier;
    });

    if (!user || user.password !== normalizedPassword) {
      throw new Error("Invalid email/username or password.");
    }

    const token = `mock-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email
    };
    window.OneSpaceAuth.setToken(token, publicUser);
    return { success: true, token, user: publicUser };
  }

  // Real mode: call backend
  const response = await requestJson("/api/auth/login/", "POST", {
    identifier: identifier,
    password: password
  });
  // Response: { token, user: { id, name, email } }
  window.OneSpaceAuth.setToken(response.token, response.user);
  return { success: true, token: response.token, user: response.user };
};

window.OneSpaceAuth.logout = async function () {
  window.OneSpaceAuth.clearToken();
  return { success: true, message: "You have been logged out." };
};

window.OneSpaceAuth.getToken = function () {
  const record = readAuthRecord();
  return record ? record.token : "";
};

window.OneSpaceAuth.setToken = function (token, user) {
  const record = {
    token: token,
    userId: user && user.id ? user.id : "",
    userName: user && user.name ? user.name : "",
    userEmail: user && user.email ? user.email : "",
    createdAt: new Date().toISOString()
  };
  window.localStorage.setItem(ONE_SPACE_AUTH_KEY, JSON.stringify(record));
};

window.OneSpaceAuth.clearToken = function () {
  window.localStorage.removeItem(ONE_SPACE_AUTH_KEY);
};

window.OneSpaceAuth.isAuthenticated = function () {
  return Boolean(window.OneSpaceAuth.getToken());
};

window.OneSpaceAuth.requireAuth = function () {
  if (!window.OneSpaceAuth.isAuthenticated()) {
    window.location.replace("login.html");
    return false;
  }
  return true;
};

window.OneSpaceAuth.getCurrentUser = function () {
  const record = readAuthRecord();
  if (!record) {
    return null;
  }
  return {
    id: record.userId || "",
    name: record.userName || "",
    email: record.userEmail || ""
  };
};

function readAuthRecord() {
  try {
    const raw = window.localStorage.getItem(ONE_SPACE_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}