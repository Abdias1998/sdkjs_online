/**
 * FeexPay JavaScript SDK
 * 
 * A JavaScript SDK for integrating FeexPay payment processing
 * into websites using HTML/CSS/JS.
 * 
 * Version: 1.0.0
 */

(function() {

    // Store SDK configuration
    const FeexPayConfig = {
      baseUrl: 'https://api.feexpay.me',
      containerId: null,
      options: {},
      modalElement: null,
      styles: null,
      shopValid: false,
      callbackCalled: false // Flag to track if callback has been called
    };
    
    // Define network API identifiers
    const networkApiIds = {
      'Benin': {
        'MTN': 'mtn',
        'MOOV': 'moov',
        'CELLTIS': 'celtiis bj',
        'CORIS': 'coris'
      },
      'Togo': {
        'YAS': 'togocom tg',
        'MOOV': 'moov tg'
      },
      'Côte d\'Ivoire': {
        'MTN': 'mtn ci',
        'ORANGE': 'orange ci',
        'MOOV': 'moov ci',
        'WAVE': 'wave ci'
      },
      'Burkina Faso': {
        'ORANGE': 'orange bf',
        'MOOV': 'moov bf'
      },
      'Senegal': {
        'ORANGE': 'orange sn',
        'FREE MONEY': 'free sn'
      },
      'Congo-Brazzaville': {
        'MTN': 'mtn cg'
      }
    };
    
    // Define networks that require OTP
    const networksRequiringOtp = ['CORIS'];
    
    // Define wallet providers by country
    const walletProviders = {
      'Benin': ['CORIS'],
      'Côte d\'Ivoire': ['WAVE']
    };
    
    // Define countries where ORANGE requires OTP
    const orangeMoneyOtpCountries = ['Senegal'];
    
    // Main FeexPayButton object to be exposed globally
    const FeexPayButton = {
      // Current payment method
      currentPaymentMethod: 'mobile',
      /**
       * Validate shop before displaying button
       * @param {string} shopId - ID of the shop to validate
       * @returns {Promise<boolean>} - Promise resolving to true if shop is valid
       */
      validateShop: function(shopId) {
        return new Promise((resolve, reject) => {
          if (!shopId) {
            // console.error('FeexPay: Shop ID is required for validation');
            resolve(false);
            return;
          }
          
          fetch(`${FeexPayConfig.baseUrl}/api/shop/${shopId}/get_shop`)
            .then(response => {
              if (response.status === 200) {
                response.json().then(data => {  
                  // console.log(data);
                  // Stocker les informations du marchand pour utilisation dans la modale
                  FeexPayConfig.merchantInfo = {
                    name: data.name,
                    reference: data.reference
                  };
                  resolve(true);
                });
                
              } else {
                // console.error(`FeexPay: Shop validation failed with status ${response.status}`);
                resolve(false);
              }
            })
            .catch(error => {
              // console.error('FeexPay: Shop validation error', error);
              resolve(false);
            });
        });
      },
      
      /**
       * Initialize the FeexPay button
       * @param {string} containerId - ID of the container element
       * @param {object} options - Configuration options
       */
      init: function(containerId, options) {
        if (!containerId) {
          // console.error('FeexPay: Container ID is required');
          return;
        }
        
        // Reset callback called flag for new initialization
        FeexPayConfig.callbackCalled = false;
        
        FeexPayConfig.containerId = containerId;
        FeexPayConfig.options = {
          id: options.id || '',
          amount: parseInt(parseInt(options.amount)) || 0,
          token: options.token || '',
          callback: options.callback || function() {},
          callback_url: options.callback_url || '',
          error_callback_url: options.error_callback_url || '',
          mode: options.mode || 'SANDBOX',
          custom_button: options.custom_button || false,
          id_custom_button: options.id_custom_button || '',
          custom_id: options.custom_id || '',
          description: options.description || '',
          case: options.case || '',
          fields_to_hide: options.fields_to_hide || [],
          callback_info: options.callback_info || '',
          currency : options.currency || 'XOF',
          case : options.case || 'ALL',
        };
        
        // Inject styles
        this.injectStyles();
        
        // Create modal (hidden initially)
        this.createModal();
        
        // Validate shop before creating button
        this.validateShop(FeexPayConfig.options.id).then(isValid => {
          FeexPayConfig.shopValid = isValid;
          
          if (!isValid) {
            // console.error(`FeexPay: Shop with ID "${FeexPayConfig.options.id}" is not valid`);
            // Still call createButton to display error message
            this.createButton();
            return;
          }
          
          // Create button or use custom button only if shop is valid
          if (FeexPayConfig.options.custom_button && FeexPayConfig.options.id_custom_button) {
            const customButton = document.getElementById(FeexPayConfig.options.id_custom_button);
            if (customButton) {
              customButton.addEventListener('click', this.showPaymentModal);
            } else {
              // console.error(`FeexPay: Custom button with ID "${FeexPayConfig.options.id_custom_button}" not found`);
            }
          } else {
            this.createButton();
          }
        });
      },
      
      /**
       * Inject required CSS styles
       */
      injectStyles: function() {
        FeexPayConfig.styles = document.createElement('style');
        FeexPayConfig.styles.textContent = `
      
  
          .feexpay-button {
            background-color: #D45D00;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 16px;
            font-family: Arial;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          
          .feexpay-button:hover {
            background-color: #ea580c;
          }
          
          .feexpay-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
          }
          
          .feexpay-modal-overlay.active {
            opacity: 1;
            visibility: visible;
          }
          
          .feexpay-modal {
          font-family: 'Gilroy-Regular', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: white;
            border-radius: 8px;
            max-width: 450px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            transform: translateY(20px);
            transition: transform 0.3s;
          }
          
          .feexpay-modal-overlay.active .feexpay-modal {
            transform: translateY(0);
          }
          
          /* Additional styles for modal content will be added dynamically */
          
          .feexpay-loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #ffffff;
            animation: feexpay-spin 1s ease-in-out infinite;
            margin-right: 8px;
            vertical-align: middle;
          }
          
          @keyframes feexpay-spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(FeexPayConfig.styles);
      },
      
      /**
       * Create the payment button
       */
      createButton: function() {
        const container = document.getElementById(FeexPayConfig.containerId);
        if (!container) {
          // console.error(`FeexPay: Container with ID "${FeexPayConfig.containerId}" not found`);
          return;
        }
        
        // Only create button if shop is valid
        if (FeexPayConfig.shopValid) {
          const button = document.createElement('button');
          button.className = 'feexpay-button';
          button.innerHTML = `Payer ${FeexPayConfig.options.amount} ${FeexPayConfig.options.currency}`;
          button.addEventListener('click', this.showPaymentModal);
          
          container.appendChild(button);
        } else {
          // Display error message when shop validation fails
          const errorMessage = document.createElement('div');
          errorMessage.className = 'feexpay-error-message';
          errorMessage.style.color = '#e11d48';
          errorMessage.style.padding = '10px';
          errorMessage.style.marginTop = '10px';
          errorMessage.style.backgroundColor = '#fff1f2';
          errorMessage.style.border = '1px solid #fecdd3';
          errorMessage.style.borderRadius = '4px';
          errorMessage.style.fontSize = '14px';
          errorMessage.innerHTML = 'Vos identifiants d\'intégration sont incorrects. Merci d\'utiliser la clé adéquate à votre environnement (live ou sandbox) actuel';
          
          container.appendChild(errorMessage);
        }
      },
      
      /**
       * Create the payment modal
       */
      createModal: function() {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'feexpay-modal-overlay';
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'feexpay-modal';
        
        // We'll add modal content when the modal is shown
        
        // Close modal when clicking outside
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) {
            this.hidePaymentModal();
          }
        });
        
        // Add modal to the overlay
        modalOverlay.appendChild(modal);
        
        // Add the overlay to the body
        document.body.appendChild(modalOverlay);
        
        // Store reference to the modal
        FeexPayConfig.modalElement = modalOverlay;
      },
      
      /**
       * Show the payment modal
       */
      showPaymentModal: function() {
        if (!FeexPayConfig.modalElement || !FeexPayConfig.shopValid) return;
        
        // Fill modal with content
        const modalContent = FeexPayConfig.modalElement.querySelector('.feexpay-modal');
        
        // Check which fields should be hidden
        const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
        const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');
        const hidePersonalInfoSection = hideNameField && hideEmailField;
        
        // Determine the starting section number based on whether personal info is hidden
        const paymentMethodsSectionNumber = hidePersonalInfoSection ? 1 : 2;
        
        // In a real implementation, this would render a full payment form
        // with inputs for personal info, payment method selection, etc.
        // For this demo, we'll use a simplified version
        
        modalContent.innerHTML = `
          <div style="position: relative;">
            <button id="feexpay-close-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div style="padding: 24px;">
              <div style="margin-bottom: 16px; text-align: left;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 20px; font-weight: bold;">
                    <img src="https://api.feexpay.me/api/static/feexpay_logo-h.png" alt="FeexPay" style="width: 120px;">
                  </span>
                  ${FeexPayConfig.merchantInfo ? `
                    <div style="text-align: right; font-size: 12px; padding: 12px">
                      <div style="font-weight: 500; margin-bottom: 4px; color: #4b5563;font-family: 'Gilroy-bold', sans-serif;">MARCHAND : ${FeexPayConfig.merchantInfo.name}</div>
                      <div style="color: #6b7280;font-family: 'Gilroy-bold', sans-serif;">ID : ${FeexPayConfig.merchantInfo.reference}</div>
                    </div>
                  ` : ''}
                </div>
              </div>
              
              <p style="text-align: center; font-size: 14px; color: #6b7280; margin-bottom: 24px;">
                Remplissez les champs suivants pour effectuer votre paiement
              </p>
              
              <!-- Payment method selection -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 24px;">
                <button class="feexpay-method-btn active" data-method="mobile" style="cursor:pointer;display: flex; flex-direction: column; align-items: center; padding: 12px; border: 1px solid #D45D00; background-color: #fff7ed; border-radius: 4px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D45D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 4px;">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12" y2="18"></line>
                  </svg>
                  <span style="font-size: 12px;">Mobile Money</span>
                </button>
                
                <button class="feexpay-method-btn" data-method="card" style="cursor:pointer;display: flex; flex-direction: column; align-items: center; padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 4px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D45D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 4px;">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  <span style="font-size: 12px;">Cartes Bancaires</span>
                </button>
                
                <button class="feexpay-method-btn" data-method="wallet" style="cursor:pointer;display: flex; flex-direction: column; align-items: center; padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 4px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D45D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 4px;">
                    <path d="M21 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"></path>
                    <path d="M23 11H17a2 2 0 0 0 0 4h6"></path>
                  </svg>
                  <span style="font-size: 12px;">Wallet</span>
                </button>
              </div>
              
              <!-- Personal Information -->
              <div id="feexpay-personal-info" style="margin-bottom: 24px;${hidePersonalInfoSection ? ' display: none;' : ''}">
                <div style="display: flex; align-items: center; margin-bottom: 2px;">
                  <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #e5e7eb; color: #4b5563; font-weight: bold; font-size: 12px; margin-right: 8px;">
                    1
                  </div>
                  <h3 style="font-weight: normal; color: #112C56;font-size:20px;">Informations Personnelles</h3>
                </div> 
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <input type="text" id="feexpay-name-input" placeholder="Nom et Prénoms" style="${hideNameField ? ' display: none;' : ''};width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
                  <input type="email" id="feexpay-email-input" placeholder="Email" style="${hideEmailField ? ' display: none;' : ''};width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
                </div>
              </div>
              
              <!-- Payment Methods -->
              <div id="feexpay-payment-methods" style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; margin-bottom: 2px;">
                  <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #e5e7eb; color: #4b5563; font-weight: bold; font-size: 12px; margin-right: 8px;">
                    ${paymentMethodsSectionNumber}
                  </div>
                  <h3 style="font-weight: normal; color: #112C56;font-size:20px;">Méthodes de paiement</h3>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; align-items: center;">
                    <div style="width: 120px;">
                      <select id="feexpay-country-select" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; background-color: white; width: 100%;">
                        <option value="Benin"> 🇧🇯 Benin</option>
                        <option value="Togo"> 🇹🇬 Togo</option>
                        <option value="Côte d'Ivoire"> 🇨🇮 Côte d'Ivoire</option>
                        <option value="Burkina Faso"> 🇧🇫 Burkina Faso</option>
                        <option value="Senegal"> 🇸🇳 Senegal</option>
                        <option value="Congo-Brazzaville"> 🇨🇬 Congo-Brazzaville</option>
                      </select>
                    </div>
                    <div style="flex: 1; margin-left: 12px;">
                      <select id="feexpay-network-select" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; background-color: white; width: 100%;">
                        <!-- Options will be populated dynamically based on country selection -->
                      </select>
                    </div>
                  </div>
                  
                  <div style="display: flex;">
                    <div id="feexpay-country-code" style="background-color: #f3f4f6; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px 0 0 4px; display: flex; align-items: center; justify-content: center; width: 60px;">
                      <span style="color: #4b5563; font-weight: 500;">+229</span>
                    </div>
                    <input type="tel" placeholder="Numéro de téléphone sans indicatif" style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 0 4px 4px 0; outline: none;">
                  </div>
                  
                  <!-- OTP field for Senegal ORANGE -->
                  <div id="feexpay-otp-field" style="display: none;">
                    <input type="text" id="feexpay-otp-input" placeholder="Code OTP" style="width: 96%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
                    <p style="margin-top: 4px; font-size: 12px; color: #6b7280;">L'otp de validation de la transaction obtenu en tapant #144#391#</p>
                  </div>
                </div>
              </div>
              
              <!-- Payment Summary -->
              <div id="feexpay-payment-summary" style="background-color: #f9fafb; padding: 12px; border-radius: 4px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                  <span>Montant :</span>
                  <span style="font-weight: 500;">${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
                </div>
                
                <div id="feexpay-fee-display" style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                  <span>Frais :</span>
                  <span id="feexpay-mobile-fee-value" style="font-weight: 500;"></span>
                </div>
                
                <div id="feexpay-total-display" style="display: flex; justify-content: space-between; font-weight: normal;">
                  <span>Montant Total à payer :</span>
                  <span id="feexpay-total-label">${Math.ceil(FeexPayConfig.options.amount * 1.017).toLocaleString()} ${FeexPayConfig.options.currency}</span>
                </div>
                
                <p id="feexpay-fee-note" style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                  *Des frais de transaction sont applicables au montant.
                </p>
              </div>
              
              <!-- Action Buttons -->
              <div style="display: flex; align-items: center; justify-content: center;">
                <button id="feexpay-back-btn" style="display: flex; align-items: center; color: #4b5563; background-color: transparent; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  <span>Retour</span>
                </button>
                
                <button id="feexpay-pay-btn" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 8px; cursor: pointer;">
                  Payer ${Math.ceil(FeexPayConfig.options.amount ).toLocaleString()} ${FeexPayConfig.options.currency}
                </button>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>Paiements sécurisés par FeexPay</p>
              <p>En payant par ce plugin, vous acceptez les <a target="_blank" href="https://feexpay.me/fr/terms-and-conditions">conditions générales d'utilisation</a> de FeexPay</p>
            </div>
          </div>
        `;
        
        // Payment method sections
        const mobileSection = modalContent.querySelector('#feexpay-payment-methods');
        const cardSection = document.createElement('div');
        cardSection.id = 'feexpay-card-section';
        cardSection.style.display = 'none';
        cardSection.innerHTML = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <h3 style="font-weight: normal; color: #112C56;font-size:20px;">Paiement par Carte Bancaire</h3>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <select id="feexpay-card-type" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; background-color: white;">
                <option value="VISA">VISA</option>
                <option value="MASTERCARD">MASTERCARD</option>
              </select>
              <input type="text" id="feexpay-firstname-input" placeholder="Prénom" style="width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
              <input type="text" id="feexpay-lastname-input" placeholder="Nom" style="width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
              <input type="email" id="feexpay-card-email-input" placeholder="Email" style="width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
              <input type="tel" id="feexpay-card-phone-input" placeholder="Numéro de téléphone avec indicatif" style="width: 100%; height: 20px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
            
            </div>
            
            <!-- Résumé du paiement par carte -->
            <div id="feexpay-card-payment-summary" style="background-color: #f9fafb; padding: 12px; border-radius: 4px; margin-top: 24px;">
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                <span>Montant :</span>
                <span style="font-weight: 500;">${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
              </div>
              
              <div id="feexpay-card-fee-display" style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                <span>Frais :</span>
                <span style="font-weight: 500;">${Math.ceil(FeexPayConfig.options.amount * 0.045).toLocaleString()} ${FeexPayConfig.options.currency}</span>
              </div>
              
              <div id="feexpay-card-total-display" style="display: flex; justify-content: space-between; font-weight: normal;">
                <span>Montant Total à payer :</span>
                <span id="feexpay-card-total-label">${Math.ceil(FeexPayConfig.options.amount * 1.045).toLocaleString()} ${FeexPayConfig.options.currency}</span>
              </div>
              
              <p id="feexpay-card-fee-note" style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                *Les frais de transaction pour VISA et MASTERCARD sont de 4,5%.
              </p>
            </div>
          </div>
        `;
        
        // Insert card section after the payment methods section
        mobileSection?.parentNode.insertBefore(cardSection, mobileSection.nextSibling);
        
        // Wallet section
        const walletSection = document.createElement('div');
        walletSection.id = 'feexpay-wallet-section';
        walletSection.style.display = 'none';
        walletSection.innerHTML = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #e5e7eb; color: #4b5563; font-weight: bold; font-size: 12px; margin-right: 8px;">
                ${paymentMethodsSectionNumber}
              </div>
              <h3 style="font-weight: normal; color: #112C56;font-size:20px;">Méthodes de paiement</h3>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center;">
                <div style="width: 120px;">
                  <select id="feexpay-wallet-country-select" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; background-color: white; width: 100%;">
                    <option value="Benin"> 🇧🇯 Benin</option>
                    <option value="Côte d'Ivoire"> 🇨🇮 Côte d'Ivoire</option>
                  </select>
                </div>
                <div style="flex: 1; margin-left: 12px;">
                  <select id="feexpay-wallet-provider-select" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; background-color: white; width: 100%;">
                    <!-- Options will be populated dynamically based on country selection -->
                  </select>
                </div>
              </div>
              
              <div style="display: flex;">
                <div id="feexpay-wallet-country-code" style="background-color: #f3f4f6; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px 0 0 4px; display: flex; align-items: center; justify-content: center; width: 60px;">
                  <span style="color: #4b5563; font-weight: 500;">+229</span>
                </div>
                <input type="tel" id="feexpay-wallet-phone-input" placeholder="Numéro de téléphone sans indicatif" style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 0 4px 4px 0; outline: none;">
              </div>
            </div>
            
            <!-- Résumé du paiement par wallet -->
            <div id="feexpay-wallet-payment-summary" style="background-color: #f9fafb; padding: 12px; border-radius: 4px; margin-top: 24px;">
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                <span>Montant :</span>
                <span style="font-weight: 500;">${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
              </div>
              
              <div id="feexpay-wallet-fee-display" style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                <span>Frais :</span>
                <span style="font-weight: 500;" id="feexpay-wallet-fee-value"></span>
              </div>
              
              <div id="feexpay-wallet-total-display" style="display: flex; justify-content: space-between; font-weight: normal;">
                <span>Montant Total à payer :</span>
                <span id="feexpay-wallet-total-label"></span>
              </div>
              
              <p id="feexpay-wallet-fee-note" style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                *Des frais de transaction sont applicables au montant.
              </p>
            </div>
          </div>
        `;
        
        // Insert wallet section after the card section
        cardSection?.parentNode.insertBefore(walletSection, cardSection.nextSibling);
        
        // Add event listeners
        const closeBtn = modalContent.querySelector('#feexpay-close-btn');
        const backBtn = modalContent.querySelector('#feexpay-back-btn');
        const payBtn = modalContent.querySelector('#feexpay-pay-btn');
        const methodBtns = modalContent.querySelectorAll('.feexpay-method-btn');
        const personalInfoSection = document.getElementById('feexpay-personal-info');
        
        // Method selection handling
        // Déterminer la méthode de paiement initiale en fonction du paramètre case et de la devise
        let currentMethod = 'mobile'; // Par défaut
        
        // Si la devise est USD ou CAD, on affiche uniquement CARD
        if (FeexPayConfig.options.currency === 'USD' || FeexPayConfig.options.currency === 'CAD') {
          currentMethod = 'card';
        } 
        // Sinon, on utilise le paramètre case
        else if (FeexPayConfig.options.case === 'MOBILE') {
          currentMethod = 'mobile';
        } else if (FeexPayConfig.options.case === 'CARD') {
          currentMethod = 'card';
        } else if (FeexPayConfig.options.case === 'WALLET') {
          currentMethod = 'wallet';
        }
        
        // Appliquer la configuration initiale en fonction de la méthode sélectionnée
        if (FeexPayConfig.options.currency === 'USD' || FeexPayConfig.options.currency === 'CAD' || FeexPayConfig.options.case !== 'ALL') {
          // Masquer les boutons non pertinents et activer le bouton correspondant
          methodBtns.forEach(btn => {
            if (btn.dataset.method !== currentMethod) {
              btn.style.display = 'none';
            } else {
              // Activer le bouton correspondant
              btn.classList.add('active');
              btn.style.borderColor = '#D45D00';
              btn.style.backgroundColor = '#fff7ed';
            }
          });
          
          // Afficher la section correspondante
          if (currentMethod === 'card') {
            if (mobileSection) mobileSection.style.display = 'none';
            cardSection.style.display = 'block';
            walletSection.style.display = 'none';
            if (personalInfoSection) personalInfoSection.style.display = 'none';
            
            // Cacher le résumé de paiement Mobile Money
            const mobileSummary = document.getElementById('feexpay-payment-summary');
            if (mobileSummary) mobileSummary.style.display = 'none';
            
            // Mettre à jour les informations de la carte plus tard
            // L'appel à updateCardInformation sera fait après l'initialisation de toutes les fonctions
          } else if (currentMethod === 'wallet') {
            if (mobileSection) mobileSection.style.display = 'none';
            cardSection.style.display = 'none';
            walletSection.style.display = 'block';
            
            // Cacher le résumé de paiement Mobile Money
            const mobileSummary = document.getElementById('feexpay-payment-summary');
            if (mobileSummary) mobileSummary.style.display = 'none';
          } else {
            // Mobile par défaut
            if (mobileSection) mobileSection.style.display = 'block';
            cardSection.style.display = 'none';
            walletSection.style.display = 'none';
            if (personalInfoSection && !hidePersonalInfoSection) personalInfoSection.style.display = 'block';
          }
        }
        
        methodBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            // Remove active class from all buttons
            methodBtns.forEach(b => {
              b.classList.remove('active');
              b.style.borderColor = '#e5e7eb';
              b.style.backgroundColor = '#f9fafb';
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            this.style.borderColor = '#D45D00';
            this.style.backgroundColor = '#fff7ed';
            
            // Update current method
            currentMethod = this.dataset.method;
            
            // Show/hide appropriate sections
            // personalInfoSection est déjà défini plus haut
            // Always hide personal info section if both name and email are hidden
            if (hidePersonalInfoSection && personalInfoSection) {
              personalInfoSection.style.display = 'none';
            }
            
            if (currentMethod === 'card') {
              if (mobileSection) mobileSection.style.display = 'none';
              cardSection.style.display = 'block';
              walletSection.style.display = 'none';
              if (personalInfoSection) personalInfoSection.style.display = 'none';
              
              // Cacher le résumé de paiement Mobile Money
              const mobileSummary = document.getElementById('feexpay-payment-summary');
              if (mobileSummary) mobileSummary.style.display = 'none';
              
              // Mettre à jour les informations de la carte (frais et montant total)
              updateCardInformation();
            } else if (currentMethod === 'wallet') {
              if (mobileSection) mobileSection.style.display = 'none';
              cardSection.style.display = 'none';
              walletSection.style.display = 'block';
              
              // Toujours masquer la section Informations Personnelles pour le mode Wallet quand fields_to_hide est défini
              if (personalInfoSection) {
                const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
                const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');
                const hidePersonalInfoSection = hideNameField && hideEmailField;
                
                if (hidePersonalInfoSection) {
                  personalInfoSection.style.display = 'none';
                } else {
                  personalInfoSection.style.display = 'block';
                }
              }
              
              // Cacher le résumé de paiement Mobile Money
              const mobileSummary = document.getElementById('feexpay-payment-summary');
              if (mobileSummary) mobileSummary.style.display = 'none';
              
              // Mettre à jour le bouton de paiement pour le mode Wallet
              if (payBtn) {
                // Afficher l'état de chargement
                payBtn.textContent = '';
                
                // Préparer les données pour la requête
                const country = walletCountrySelect.value;
                const provider = walletProviderSelect.value || (walletProviders[country] && walletProviders[country][0]);
                
                if (provider) {
                  const requestData = {
                    amount: FeexPayConfig.options.amount,
                    reseau: provider,
                    shop: FeexPayConfig.options.id
                  };
                  
                  // Déterminer le taux de frais en fonction du pays et du fournisseur
                  let feeRate = 0.017; // Taux par défaut (1,7%)
                  
                  if (country === 'Benin' && provider === 'CORIS') {
                    feeRate = 0.017; // 1,7% pour Coris au Bénin
                  } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
                    feeRate = 0.032; // 3,2% pour Wave en Côte d'Ivoire
                  }
                  
                  // Faire une requête API pour vérifier si les frais doivent être appliqués
                  fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                  })
                  .then(response => response.json())
                  .then(data => {
                    // Déterminer si les frais doivent être appliqués
                    const shouldApplyFees = data.iffees === true;
                    
                    // Calculer les frais et le montant total
                    let feeAmount = 0;
                    if (shouldApplyFees) {
                      feeAmount = Math.ceil(FeexPayConfig.options.amount * feeRate);
                    }
                    const totalAmount = FeexPayConfig.options.amount + feeAmount;
                    
                    // Mettre à jour le texte du bouton
                    payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                  })
                  .catch(error => {
                    // console.error('Error checking transaction fees for wallet button:', error);
                    // En cas d'erreur, afficher le montant sans frais
                    payBtn.textContent = `Payer ${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                  });
                } else {
                  // Si aucun fournisseur n'est disponible, afficher le montant sans frais
                  payBtn.textContent = `Payer ${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                }
              }
            } else {
              if (mobileSection) mobileSection.style.display = 'block';
              cardSection.style.display = 'none';
              if (personalInfoSection && !hidePersonalInfoSection) personalInfoSection.style.display = 'block';
              
              // Réafficher le résumé de paiement Mobile Money
              const mobileSummary = document.getElementById('feexpay-payment-summary');
              if (mobileSummary) mobileSummary.style.display = 'block';
              walletSection.style.display = 'none';
            }
          });
        });
        
        if (closeBtn) closeBtn.addEventListener('click', function() {
          FeexPayButton.hidePaymentModal();
        });
        
        if (backBtn) backBtn.addEventListener('click', function() {
          FeexPayButton.hidePaymentModal();
        });
        
        if (payBtn) {
          payBtn.addEventListener('click', function() {
            if (currentMethod === 'card') {
              FeexPayButton.processCardPayment();
            } else if (currentMethod === 'wallet') {
              FeexPayButton.processWalletPayment();
            } else {
              FeexPayButton.processPayment();
            }
          });
        }
        
        // Country and network selection
        const countrySelect = modalContent.querySelector('#feexpay-country-select');
        const networkSelect = modalContent.querySelector('#feexpay-network-select');
        
        // Define networks by country
        const networksByCountry = {
          'Benin': ['MTN', 'MOOV', 'CELLTIS', 'CORIS'],
          'Togo': ['YAS', 'MOOV'],
          'Côte d\'Ivoire': ['MTN', 'ORANGE', 'MOOV', 'WAVE'],
          'Burkina Faso': ['ORANGE', 'MOOV'],
          'Senegal': ['ORANGE', 'FREE MONEY'],
          'Congo-Brazzaville': ['MTN']
        };
        
        // Use the globally defined networkApiIds and networksRequiringOtp
        
        // Define fee rates by country and network
        const feeRates = {
          'Benin': {
            'MTN': 0.017,
            'MOOV': 0.017,
            'CELLTIS': 0.017,
            'CORIS': 0.017
          },
          'Togo': {
            'YAS': 0.03,
            'MOOV': 0.03
          },
          'Côte d\'Ivoire': {
            'MTN': 0.029,
            'ORANGE': 0.029,
            'MOOV': 0.029,
            'WAVE': 0.032
          },
          'Burkina Faso': {
            'ORANGE': 0.039,
            'MOOV': 0.022
          },
          'Senegal': {
            'ORANGE': 0.019,
            'FREE MONEY': 0.019
          },
          'Congo-Brazzaville': {
            'MTN': 0.03,
          
          }
        };
        
        // Define country codes
        const countryCodes = {
          'Benin': '+229',
          'Togo': '+228',
          'Côte d\'Ivoire': '+225',
          'Burkina Faso': '+226',
          'Senegal': '+221',
          'Congo-Brazzaville': '+242'
        };
        
        // Function to update network options, country code, and fee information
        const updateNetworkOptions = (country) => {
          // Clear existing options
          networkSelect.innerHTML = '';
          
          // Add new options based on selected country
          const networks = networksByCountry[country] || [];
          networks.forEach(network => {
            const option = document.createElement('option');
            option.value = network;
            option.textContent = network;
            networkSelect.appendChild(option);
          });
          
          // Update country code
          const countryCodeElement = modalContent.querySelector('#feexpay-country-code span');
          if (countryCodeElement) {
            countryCodeElement.textContent = countryCodes[country] || '+229';
          }
          
          // Update fee information based on country and first network
          updateFeeInformation(country, networks[0]);
        };
        
        // Function to update fee information based on country and network
        const updateFeeInformation = (country, network) => {
          // First check with the API if fees should be applied
          const feeRate = feeRates[country]?.[network] || 0.017; // Default to 1.7% if not found
          
          // Prepare request data
          const requestData = {
            amount: FeexPayConfig.options.amount,
            reseau: network,
            shop: FeexPayConfig.options.id
          };
          
          // Show loading state
          const feeDisplay = modalContent.querySelector('#feexpay-fee-display span:last-child');
          const totalDisplay = modalContent.querySelector('#feexpay-total-label');
          const feeNote = modalContent.querySelector('#feexpay-fee-note');
          const payBtn = modalContent.querySelector('#feexpay-pay-btn');
          const mobileFeeValue = modalContent.querySelector('#feexpay-mobile-fee-value');
          
          if (feeDisplay) feeDisplay.textContent = '';
          if (totalDisplay) totalDisplay.textContent = '';
          if (mobileFeeValue) mobileFeeValue.textContent = '';
          
          // Make API request to check if fees should be applied
          fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          })
          .then(response => response.json())
          .then(data => {
            // Determine if fees should be applied
            const shouldApplyFees = data.iffees === true;
            // console.log('FeexPay: Should apply fees:', shouldApplyFees, data);
            
            // Calculate amounts
            let feeAmount = 0;
            if (shouldApplyFees) {
              // Calculer les frais avec plus de précision
              const exactFeeAmount = FeexPayConfig.options.amount * feeRate;
              // console.log('FeexPay: Exact fee amount before rounding:', exactFeeAmount);
              
              // S'assurer que les frais sont au moins de 1 FCFA si des frais doivent être appliqués
            //   feeAmount = Math.max(1, Math.ceil(exactFeeAmount));
            feeAmount = Math.ceil(exactFeeAmount);
            }
            const totalAmount = FeexPayConfig.options.amount + feeAmount;
              // Mettre à jour l'affichage des frais
              if (mobileFeeValue) {
                if (shouldApplyFees) {
                  mobileFeeValue.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                } else {
                  mobileFeeValue.textContent = `0 ${FeexPayConfig.options.currency}`;
                }
              }
            // console.log('FeexPay: Calculated amounts:', {
            //   baseAmount: FeexPayConfig.options.amount,
            //   feeRate,
            //   feeAmount,
            //   totalAmount,
            //   shouldApplyFees
            // });
  
            
            
            // Update fee display
            const feeDisplayRow = modalContent.querySelector('#feexpay-fee-display');
            if (feeDisplayRow) {
              if (shouldApplyFees) {
                feeDisplayRow.style.display = 'flex';
                if (feeDisplay) {
                  feeDisplay.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                }
              } else {
                // Masquer complètement la ligne des frais si aucun frais n'est applicable
                // feeDisplayRow.style.display = '';
              }
            }
            
            // Update total amount display
            // console.log('FeexPay: Total display element:', totalDisplay);
            if (totalDisplay) {
              // console.log('FeexPay: Updating total display with:', `${totalAmount.toLocaleString()} FCFA`);
              totalDisplay.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            } else {
              // console.log('FeexPay: Total display element not found, trying direct selection');
              const directTotalLabel = modalContent.querySelector('#feexpay-total-label');
              if (directTotalLabel) {
                // console.log('FeexPay: Found total label by direct selection');
                directTotalLabel.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              } 
            }
            
            // Update fee note
            if (feeNote) {
              if (shouldApplyFees) {
                const feePercentage = (feeRate * 100).toFixed(1).replace('.0', '');
                feeNote.textContent = `*Des frais de transaction de ${feePercentage}% sont applicables au montant.`;
              } else {
                feeNote.textContent = '*Aucun frais de transaction applicable pour cette transaction.';
              }
            }
            
            // Update pay button text
            if (payBtn) {
              payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
          })
          .catch(error => {
            // console.error('Error checking transaction fees:', error);
            
            // Par défaut, ne pas appliquer de frais en cas d'erreur
            const feeAmount = 0;
            const totalAmount = FeexPayConfig.options.amount;
            
            // Masquer la ligne des frais en cas d'erreur
            const feeDisplayRow = modalContent.querySelector('#feexpay-fee-display');
            if (feeDisplayRow) {
              feeDisplayRow.style.display = 'none';
            }
            
            if (totalDisplay) totalDisplay.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            
            if (feeNote) {
              feeNote.style.display = 'none';
            }
            
            if (payBtn) {
              payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
          });
        };
        
        // Function to update card fee information
        const updateCardInformation = () => {
          // Taux de frais pour les cartes (4.5% par défaut)
          const cardFeeRate = 0.045;
          
          // Récupérer les éléments du DOM
          const cardFeeDisplay = document.getElementById('feexpay-card-fee-display');
          const cardTotalLabel = document.getElementById('feexpay-card-total-label');
          const cardFeeNote = document.getElementById('feexpay-card-fee-note');
          const payBtn = document.getElementById('feexpay-pay-btn');
          
          // Afficher l'état de chargement
          if (cardFeeDisplay) {
            const feeSpan = cardFeeDisplay.querySelector('span:last-child');
            if (feeSpan) feeSpan.textContent = '...';
          }
          if (cardTotalLabel) cardTotalLabel.textContent = '...';
          
          // Préparer les données pour la requête
          const requestData = {
            amount: FeexPayConfig.options.amount,
            reseau: 'CARD', // Type de réseau pour les cartes
            shop: FeexPayConfig.options.id
          };
          
          // Faire la requête API pour vérifier les frais
          fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          })
          .then(response => response.json())
          .then(data => {
            // Déterminer si les frais doivent être appliqués
            const shouldApplyFees = data.iffees === true;
            
            // Calculer les frais et le montant total
            let feeAmount = 0;
            if (shouldApplyFees) {
              feeAmount = Math.ceil(FeexPayConfig.options.amount * cardFeeRate);
            }
            const totalAmount = FeexPayConfig.options.amount + feeAmount;
            
            // Mettre à jour l'affichage des frais
            if (cardFeeDisplay) {
              const feeSpan = cardFeeDisplay.querySelector('span:last-child');
              if (feeSpan) {
                feeSpan.textContent = shouldApplyFees ? 
                  `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}` :`0 ${FeexPayConfig.options.currency}`;
              }
            }
            
            // Mettre à jour le montant total
            if (cardTotalLabel) {
              cardTotalLabel.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
            
            // Mettre à jour la note sur les frais
            if (cardFeeNote) {
              cardFeeNote.textContent = shouldApplyFees ?
                `*Les frais de transaction pour VISA et MASTERCARD sont de ${(cardFeeRate * 100).toFixed(1)}%.` :
                '*Aucun frais de transaction applicable pour cette transaction.';
            }
            
            // Mettre à jour le bouton de paiement si on est en mode carte
            if (payBtn && currentMethod === 'card') {
              payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
            
            return {
              feeAmount,
              totalAmount
            };
          })
          .catch(error => {
            // En cas d'erreur, appliquer les frais par défaut
            const feeAmount = Math.ceil(FeexPayConfig.options.amount * cardFeeRate);
            const totalAmount = FeexPayConfig.options.amount + feeAmount;
            
            // Mettre à jour l'interface avec les valeurs par défaut
            if (cardFeeDisplay) {
              const feeSpan = cardFeeDisplay.querySelector('span:last-child');
              if (feeSpan) feeSpan.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
            if (cardTotalLabel) cardTotalLabel.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            if (cardFeeNote) {
              cardFeeNote.textContent = `*Les frais de transaction pour VISA et MASTERCARD sont de ${(cardFeeRate * 100).toFixed(1)}%.`;
            }
            if (payBtn && currentMethod === 'card') {
              payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
            
            return {
              feeAmount,
              totalAmount
            };
          });
        };
        
        // Initialize network options for default country
        updateNetworkOptions(countrySelect.value);
        
        // Initialize card information
        updateCardInformation();
        
        // Function to toggle OTP field visibility based on country and network
        const toggleOtpField = (country, network) => {
          const otpField = document.getElementById('feexpay-otp-field');
          if (otpField) {
            if (country === 'Senegal' && network === 'ORANGE') {
              otpField.style.display = 'block';
            } else {
              otpField.style.display = 'none';
            }
          }
        };
        
        // Update network options, country code, and fee information when country changes
        countrySelect.addEventListener('change', function() {
          updateNetworkOptions(this.value);
          // Check if we need to show/hide OTP field after network options are updated
          toggleOtpField(this.value, networkSelect.value);
        });
        
        // Update fee information when network changes
        networkSelect.addEventListener('change', function() {
          updateFeeInformation(countrySelect.value, this.value);
          // Check if we need to show/hide OTP field
          toggleOtpField(countrySelect.value, this.value);
          
          // Update payment button text
          const payBtn = document.getElementById('feexpay-pay-btn');
          if (payBtn) {
            const feeRate = feeRates[countrySelect.value]?.[this.value] || 0.017;
            const feeAmount = Math.ceil(FeexPayConfig.options.amount * feeRate);
            const totalAmount = FeexPayConfig.options.amount + feeAmount;
            payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
          }
        });
        
        // Initialize OTP field visibility
        toggleOtpField(countrySelect.value, networkSelect.value);
        
        // Wallet functionality
        const walletCountrySelect = modalContent.querySelector('#feexpay-wallet-country-select');
        const walletProviderSelect = modalContent.querySelector('#feexpay-wallet-provider-select');
        const walletCountryCode = modalContent.querySelector('#feexpay-wallet-country-code span');
        
        // Function to update wallet fee information based on country and provider
        const updateWalletFeeInformation = (country, provider) => {
          // Déterminer le taux de frais en fonction du pays et du fournisseur
          let feeRate = 0.017; // Taux par défaut (1,7%)
          
          if (country === 'Benin' && provider === 'CORIS') {
            feeRate = 0.017; // 1,7% pour Coris au Bénin
          } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
            feeRate = 0.032; // 3,2% pour Wave en Côte d'Ivoire
          }
          
          // Afficher l'état de chargement
          const feeValueElement = document.getElementById('feexpay-wallet-fee-value');
          const totalLabelElement = document.getElementById('feexpay-wallet-total-label');
          const feeNoteElement = document.getElementById('feexpay-wallet-fee-note');
          
          if (feeValueElement) feeValueElement.textContent = '';
          if (totalLabelElement) totalLabelElement.textContent = '';
          
          // Préparer les données pour la requête
          const requestData = {
            amount: FeexPayConfig.options.amount,
            reseau: provider,
            shop: FeexPayConfig.options.id
          };
          
          // Faire une requête API pour vérifier si les frais doivent être appliqués
          fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          })
          .then(response => response.json())
          .then(data => {
            // Déterminer si les frais doivent être appliqués
            const shouldApplyFees = data.iffees === true;
            // console.log('FeexPay Wallet: Should apply fees:', shouldApplyFees, data);
            
            // Calculer les frais et le montant total
            let feeAmount = 0;
            if (shouldApplyFees) {
              feeAmount = Math.ceil(FeexPayConfig.options.amount * feeRate);
            }
            const totalAmount = FeexPayConfig.options.amount + feeAmount;
            
            // Mettre à jour l'affichage des frais
            if (feeValueElement) {
              if (shouldApplyFees) {
                feeValueElement.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              } else {
                feeValueElement.textContent = `0 ${FeexPayConfig.options.currency}`;
              }
            }
            
            // Mettre à jour l'affichage du montant total
            if (totalLabelElement) {
              totalLabelElement.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }
            
            // Mettre à jour la note sur les frais
            if (feeNoteElement) {
              if (shouldApplyFees) {
                const feePercentage = (feeRate * 100).toFixed(1).replace('.0', '');
                feeNoteElement.innerHTML = `*Des frais de transaction de ${feePercentage}% sont applicables au montant.`;
              } else {
                feeNoteElement.innerHTML = '*Aucun frais de transaction applicable pour cette transaction.';
              }
            }
            
            // Mettre à jour le texte du bouton de paiement si le mode Wallet est actif
            if (currentMethod === 'wallet') {
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              }
            }
          })
          .catch(error => {
            // console.error('Error checking transaction fees for wallet:', error);
            
            // En cas d'erreur, ne pas appliquer de frais
            const feeAmount = 0;
            const totalAmount = FeexPayConfig.options.amount;
            
            // Mettre à jour l'interface
            if (feeValueElement) feeValueElement.textContent = `0 ${FeexPayConfig.options.currency}`;
            if (totalLabelElement) totalLabelElement.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            if (feeNoteElement) feeNoteElement.innerHTML = '*Aucun frais de transaction applicable pour cette transaction.';
            
            // Mettre à jour le bouton de paiement
            if (currentMethod === 'wallet') {
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              }
            }
          });
        };
        
        // Function to update wallet providers based on country
        const updateWalletProviders = (country) => {
          // Clear existing options
          walletProviderSelect.innerHTML = '';
          
          // Add new options based on selected country
          const providers = walletProviders[country] || [];
          providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = provider;
            walletProviderSelect.appendChild(option);
          });
          
          // Update country code
          if (walletCountryCode) {
            walletCountryCode.textContent = countryCodes[country] || '+229';
          }
          
          // Mettre à jour les informations de frais pour le premier fournisseur
          if (providers.length > 0) {
            updateWalletFeeInformation(country, providers[0]);
          }
        };
        
        // Initialize wallet providers for default country
        updateWalletProviders(walletCountrySelect.value);
        
        // Update wallet providers when country changes
        walletCountrySelect.addEventListener('change', function() {
          updateWalletProviders(this.value);
        });
        
        // Update fee information when provider changes
        walletProviderSelect.addEventListener('change', function() {
          updateWalletFeeInformation(walletCountrySelect.value, this.value);
        });
        
        // Initialize fee information for the default country and provider
        if (walletProviders[walletCountrySelect.value]?.length > 0) {
          updateWalletFeeInformation(walletCountrySelect.value, walletProviders[walletCountrySelect.value][0]);
        }
        
        // Method selection buttons
        const methodButtons = modalContent.querySelectorAll('.feexpay-method-btn');
        methodButtons.forEach(btn => {
          btn.addEventListener('click', function() {
            // Remove active class from all buttons
            methodButtons.forEach(b => {
              b.classList.remove('active');
              b.style.border = '1px solid #e5e7eb';
              b.style.backgroundColor = '#f9fafb';
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            this.style.border = '1px solid #D45D00';
            this.style.backgroundColor = '#fff7ed';
          });
        });
        
        // Show the modal
        FeexPayConfig.modalElement.classList.add('active');
        
        // Mettre à jour les informations de la carte si nécessaire
        if (currentMethod === 'card') {
          // Attendre que toutes les fonctions soient définies
          setTimeout(() => {
            if (typeof updateCardInformation === 'function') {
              updateCardInformation();
            }
          }, 0);
        }
      },
      
      /**
       * Hide the payment modal
       */
      hidePaymentModal: function() {
        if (!FeexPayConfig.modalElement) return;
        FeexPayConfig.modalElement.classList.remove('active');
      },
      
      /**
       * Show result modal with transaction status
       */
      showResultModal: function(status, message, reference) {
        // Create result modal if it doesn't exist
        if (!FeexPayConfig.resultModalElement) {
          const resultModalOverlay = document.createElement('div');
          resultModalOverlay.className = 'feexpay-modal-overlay';
          resultModalOverlay.style.position = 'fixed';
          resultModalOverlay.style.top = '0';
          resultModalOverlay.style.left = '0';
          resultModalOverlay.style.width = '100%';
          resultModalOverlay.style.height = '100%';
          resultModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          resultModalOverlay.style.display = 'flex';
          resultModalOverlay.style.alignItems = 'center';
          resultModalOverlay.style.justifyContent = 'center';
          resultModalOverlay.style.zIndex = '9999';
          resultModalOverlay.style.opacity = '0';
          resultModalOverlay.style.visibility = 'hidden';
          resultModalOverlay.style.transition = 'opacity 0.3s, visibility 0.3s';
          
          const resultModal = document.createElement('div');
          resultModal.className = 'feexpay-result-modal';
          resultModal.style.backgroundColor = 'white';
          resultModal.style.borderRadius = '8px';
          resultModal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          resultModal.style.width = '90%';
          resultModal.style.maxWidth = '400px';
          resultModal.style.overflow = 'hidden';
          resultModal.style.transform = 'scale(0.9)';
          resultModal.style.transition = 'transform 0.3s';
          
          resultModalOverlay.appendChild(resultModal);
          document.body.appendChild(resultModalOverlay);
          
          FeexPayConfig.resultModalElement = resultModalOverlay;
        }
        
        // Get the modal content container
        const resultModal = FeexPayConfig.resultModalElement.querySelector('.feexpay-result-modal');
        
        // Set content based on status
        const isSuccess = status === 'SUCCESSFUL';
        const statusColor = isSuccess ? '#10b981' : '#ef4444';
        const statusIcon = isSuccess ? 
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : 
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        
        const statusText = isSuccess ? 'Paiement réussi' : 'Paiement échoué';
        const buttonText = isSuccess ? 'Fermer' : 'Réessayer';
        
        // Set the modal content
        resultModal.innerHTML = `
          <div style="padding: 24px; text-align: center;">
            <div style="color: ${statusColor}; margin-bottom: 16px;">
              ${statusIcon}
            </div>
            <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #112C56;">${statusText}</h3>
            <p style="color: #6b7280; margin-bottom: 16px;">${message}</p>
            ${reference ? `<p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">Référence: ${reference}</p>` : ''}
            <button id="feexpay-result-btn" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
              ${buttonText}
            </button>
          </div>
        `;
        const phoneInput = document.querySelector('#feexpay-country-code + input[type="tel"]');
        const phone = phoneInput.value;
          
        // Get country code without the + sign
        const countryCodeElement = document.querySelector('#feexpay-country-code span');
        let countryCode = '';
        if (countryCodeElement) {
          countryCode = countryCodeElement.textContent.replace('+', '');
        } else {
          // Fallback to country codes if element not found
          // Utilisation des countryCodes définis dans showPaymentModal
          const countryCodes = {
            'Benin': '+229',
            'Togo': '+228',
            'Côte d\'Ivoire': '+225',
            'Burkina Faso': '+226',
            'Senegal': '+221',
            'Congo-Brazzaville': '+242'
          };
          countryCode = countryCodes[country]?.replace('+', '') || '';
        }
        
        // Get personal information if available
        const otpInput = document.getElementById('feexpay-otp-input');
  
        let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques
  
        if (cleanPhone.startsWith(countryCode + countryCode)) {
            cleanPhone = cleanPhone.substring(countryCode.length); // Supprime le 1er code pays
          } else if (cleanPhone.startsWith(countryCode)) {
            // Si ça commence une seule fois, on laisse (optionnel)
            cleanPhone = cleanPhone.substring(countryCode.length);
          }
  
          // Ajoute le code pays une seule fois
  const formattedPhone = countryCode + cleanPhone;
  
  const networkSelect = document.getElementById('feexpay-network-select');
  
  const networkDisplay = networkSelect.value;
  
  const nameInput = document.getElementById('feexpay-name-input');
  const nameDisplay = nameInput.value;
  
  const emailInput = document.getElementById('feexpay-email-input');
  const emailDisplay = emailInput.value;
  
        // Add event listener to the button
        const resultBtn = resultModal.querySelector('#feexpay-result-btn');
        if (resultBtn) {
          if (isSuccess) {
            // For success, just close the modal
            resultBtn.addEventListener('click', () => {
              this.hideResultModal();
              
              // Call callback function if it hasn't been called already
              if (typeof FeexPayConfig.options.callback === 'function' && !FeexPayConfig.callbackCalled) {
                FeexPayConfig.options.callback({
                  reference : reference,
                  status: 'SUCCESSFUL',
                  phoneNumber : formattedPhone,
                  transaction_id: reference || ('FP-' + Math.random().toString(36).substring(2, 11).toUpperCase()),
                  amount: FeexPayConfig.options.amount,
                  custom_id: FeexPayConfig.options.custom_id,
                  description: FeexPayConfig.options.description,
                  reseau : networkDisplay,
                  callback_info : FeexPayConfig.options.callback_info,
                  fullName : nameDisplay || '',
                  email : emailDisplay || '',
  
                  
                });
                
                // Mark callback as called to prevent duplicate calls
                FeexPayConfig.callbackCalled = true;
              }
              
              // Redirect if callback URL is provided
              if (FeexPayConfig.options.callback_url) {
                window.location.href = FeexPayConfig.options.callback_url;  // SDK JS
              }
  
            //Redirect if error_callback_url is provided
              if (FeexPayConfig.options.error_callback_url) {
                window.location.href = FeexPayConfig.options.error_callback_url;  
              }
           
            });
          } else {
            // For failure, retry the payment
            resultBtn.addEventListener('click', () => {
              this.hideResultModal();
              // Reset the payment form for retry
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
            });
          }
        }
  
  
        // Redirection vers le callback_url automatiquement, succès ou échec
  
        
       // Automatically call callback for success or failure without waiting for button click
  if (typeof FeexPayConfig.options.callback === 'function' && !FeexPayConfig.callbackCalled) {
    FeexPayConfig.options.callback({
      status: status,
      transaction_id: reference || ('FP-' + Math.random().toString(36).substring(2, 11).toUpperCase()),
      amount: FeexPayConfig.options.amount,
      custom_id: FeexPayConfig.options.custom_id,
      reference : reference,
      phoneNumber : formattedPhone,
      reseau : networkDisplay,
      callback_info : FeexPayConfig.options.callback_info,
      fullName : nameDisplay || '',
      email : emailDisplay || '',
    });
  
    FeexPayConfig.callbackCalled = true;
  
    // 👉 Redirige vers le callback_url automatiquement, succès ou échec
    // 👉 Redirige uniquement si le statut est SUCCESSFUL ou FAILED
  if (status === 'SUCCESSFUL' || status === 'FAILED') {
    redirectToCallbackURL(reference);
  }
  
  }
  
        
        // Reset the payment button if it exists
        const payBtn = document.getElementById('feexpay-pay-btn');
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
        
        // Show the modal
        FeexPayConfig.resultModalElement.style.opacity = '1';
        FeexPayConfig.resultModalElement.style.visibility = 'visible';
        resultModal.style.transform = 'scale(1)';
      },
      
      /**
       * Hide the result modal
       */
      hideResultModal: function() {
        if (!FeexPayConfig.resultModalElement) return;
        
        const resultModal = FeexPayConfig.resultModalElement.querySelector('.feexpay-result-modal');
        
        // Animate out
        FeexPayConfig.resultModalElement.style.opacity = '0';
        FeexPayConfig.resultModalElement.style.visibility = 'hidden';
        if (resultModal) {
          resultModal.style.transform = 'scale(0.9)';
        }
      },
      
      /**
       * Process the payment
       */
      processPayment: function() {
        // Get selected country and network
        const countrySelect = document.getElementById('feexpay-country-select');
        const networkSelect = document.getElementById('feexpay-network-select');
        const phoneInput = document.querySelector('#feexpay-country-code + input[type="tel"]');
        
        if (!countrySelect || !networkSelect || !phoneInput) {
          // console.error('FeexPay: Required form elements not found');
          return;
        }
        
        const country = countrySelect.value;
        const networkDisplay = networkSelect.value;
        const phone = phoneInput.value.trim();
        
        // Validate phone number
        if (!phone) {
          this.showResultModal('FAILED', 'Veuillez entrer un numéro de téléphone valide', '');
          return;
        }
        
        // Get the pay button reference first
        const payBtn = document.getElementById('feexpay-pay-btn');
        
        // Validate personal information fields if they are visible
        const personalInfoSection = document.getElementById('feexpay-personal-info');
        const nameInput = document.getElementById('feexpay-name-input');
        const emailInput = document.getElementById('feexpay-email-input');
        
        // Check if personal info section is visible and not hidden by fields_to_hide option
        if (personalInfoSection && personalInfoSection.style.display !== 'none') {
          // Check if name field is visible and empty
          if (nameInput && nameInput.style.display !== 'none' && !nameInput.value.trim()) {
            this.showResultModal('FAILED', 'Veuillez entrer votre nom et prénoms', '');
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            return;
          }
          
          // Check if email field is visible and empty
          if (emailInput && emailInput.style.display !== 'none' && !emailInput.value.trim()) {
            this.showResultModal('FAILED', 'Veuillez entrer votre adresse email', '');
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            return;
          }
        }
        
        // Show loading state
        if (payBtn) {
          payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          payBtn.disabled = true;
        }
        
        // Get API network identifier
        const networkApiId = networkApiIds[country]?.[networkDisplay];
        if (!networkApiId) {
          // console.error(`FeexPay: Network API identifier not found for ${networkDisplay} in ${country}`);
          return;
        }
        
        // Get country code without the + sign
        const countryCodeElement = document.querySelector('#feexpay-country-code span');
        let countryCode = '';
        if (countryCodeElement) {
          countryCode = countryCodeElement.textContent.replace('+', '');
        } else {
          // Fallback to country codes if element not found
          // Utilisation des countryCodes définis dans showPaymentModal
          const countryCodes = {
            'Benin': '+229',
            'Togo': '+228',
            'Côte d\'Ivoire': '+225',
            'Burkina Faso': '+226',
            'Senegal': '+221',
            'Congo-Brazzaville': '+242'
          };
          countryCode = countryCodes[country]?.replace('+', '') || '';
        }
        
        // Get personal information if available
        const otpInput = document.getElementById('feexpay-otp-input');
        const fullName = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const otp = otpInput && country === 'Senegal' && networkDisplay === 'ORANGE' ? otpInput.value.trim() : '';
  
        let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques
  
        if (cleanPhone.startsWith(countryCode + countryCode)) {
            cleanPhone = cleanPhone.substring(countryCode.length); // Supprime le 1er code pays
          } else if (cleanPhone.startsWith(countryCode)) {
            // Si ça commence une seule fois, on laisse (optionnel)
            cleanPhone = cleanPhone.substring(countryCode.length);
          }
  
          // Ajoute le code pays une seule fois
  const formattedPhone = countryCode + cleanPhone;
  
  
        // Prepare payment data with country code prefix for phone number
        const paymentData = {
          amount: FeexPayConfig.options.amount,
          phoneNumber: formattedPhone,
          shop: FeexPayConfig.options.id,
          callback_info: {
            custom_id: FeexPayConfig.options.custom_id || '',
            description: FeexPayConfig.options.description || '',
            
          },
          // Additional fields for CORIS payments
          country: countryCode,
          phoneNumberRight: phone,
          currency: FeexPayConfig.options.currency,
          description: FeexPayConfig.options.description || '',
          email: email || '',
          first_name: fullName || '',
          otp: otp, // Utilise le code OTP pour ORANGE au Sénégal
          reseau: networkApiId.toUpperCase(),
          token: FeexPayConfig.options.token,
        };
        
        // Check if this is a CORIS payment
        if (networkDisplay === 'CORIS') {
          // Process CORIS payment directly
          this.submitPayment('coris', paymentData);
          return;
        }
        
        // Cas spécial pour ORANGE au Sénégal (utilise notre champ OTP personnalisé)
        if (country === 'Senegal' && networkDisplay === 'ORANGE') {
          // Vérifier si l'OTP a été saisi
          const otpInput = document.getElementById('feexpay-otp-input');
          if (!otpInput || !otpInput.value.trim()) {
           
            this.showResultModal('FAILED', 'Veuillez entrer le code OTP obtenu en tapant #144#391#', '');
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
            return;
          }
          
          // L'OTP est déjà inclus dans paymentData grâce à notre modification précédente
          // Traiter le paiement directement
          this.submitPayment(networkApiId, paymentData);
          return;
        }
        
        // Check if network requires OTP (other than CORIS which is handled separately)
        const requiresOtp = networksRequiringOtp.includes(networkDisplay) && 
                           networkDisplay !== 'CORIS';
        
        if (requiresOtp) {
          // Pour les autres réseaux nécessitant un OTP, afficher le champ OTP standard
          const modalContent = FeexPayConfig.modalElement.querySelector('.feexpay-modal');
          const paymentSection = modalContent.querySelector('#feexpay-payment-section');
          
          if (paymentSection) {
            // Create OTP section
            const otpSection = document.createElement('div');
            otpSection.id = 'feexpay-otp-section';
            otpSection.style.marginBottom = '24px';
            
            otpSection.innerHTML = `
              <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #e5e7eb; color: #4b5563; font-weight: bold; font-size: 12px; margin-right: 8px;">
                  3
                </div>
                <h3 style="font-weight: bold; color: #112C56;">Code OTP</h3>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <input type="text" id="feexpay-dynamic-otp-input" placeholder="Entrez le code OTP reçu" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
                <p style="font-size: 12px; color: #6b7280;">Un code OTP a été envoyé à votre téléphone. Veuillez l'entrer ci-dessus pour compléter la transaction.</p>
              </div>
            `;
            
            // Insert before the payment summary
            const paymentSummary = modalContent.querySelector('#feexpay-payment-summary');
            if (paymentSummary) {
              paymentSummary.parentNode.insertBefore(otpSection, paymentSummary);
            }
            
            // Update pay button to submit OTP
            if (payBtn) {
              payBtn.textContent = 'Valider OTP';
              payBtn.disabled = false;
              payBtn.onclick = function() {
                const otpInput = document.getElementById('feexpay-dynamic-otp-input');
                if (!otpInput || !otpInput.value.trim()) {
                  alert('Veuillez entrer le code OTP');
                  return;
                }
                
                // Add OTP to payment data
                paymentData.otp = otpInput.value.trim();
                
                // Process payment with OTP
                FeexPayButton.submitPayment(networkApiId, paymentData);
              };
            }
          }
        } else {
          // For networks not requiring OTP, process payment directly
          FeexPayButton.submitPayment(networkApiId, paymentData);
        }
      },
      
      /**
       * Submit payment to API
       * @param networkApiId - API identifier for the network
       * @param paymentData - Payment data to submit
       */
      submitPayment: function(networkApiId, paymentData) {
        const payBtn = document.getElementById('feexpay-pay-btn');
        if (payBtn) {
          payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          payBtn.disabled = true;
        }
        
        // Special handling for CORIS in Benin
        // console.log('Network API ID:', networkApiId, 'Network Display:', paymentData.reseau);
        if (networkApiId === 'coris' || paymentData.reseau === 'CORIS') {
          // console.log('Processing CORIS payment');
          this.processCorisPayment(paymentData);
          return;
        }
        
        // Special handling for WAVE in Côte d'Ivoire
        if (networkApiId === 'wave_ci' || paymentData.reseau === 'WAVE') {
          // console.log('Processing WAVE CI payment');
          this.processWaveCIPayment(paymentData);
          return;
        }
        
        // Make API request to process payment
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FeexPayConfig.options.token}`
          },
          body: JSON.stringify(paymentData)
        })
        .then(response => response.json())
        .then(data => {
          // Check if we have a reference to poll
          if (data.reference && (data.status === 'PENDING' || data.status===202 || !data.status) ) {
            // Update button to show polling status
            if (payBtn) {
              payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
            }
            
            // Start polling for transaction status
            this.pollTransactionStatus(data.reference, payBtn, paymentData);
          } else if (data.status === 'SUCCESSFUL') {
            // Transaction already successful
            this.handleSuccessfulTransaction(data);
          } 
          else if (data.statusCode === "92") {
            this.showResultModal(
              'FAILED',
              'Votre session USSD a expiré ou la transaction a été annulé. Veuillez réessayer ! ',
           
            );
          }
          else if (data.statusCode === "10") {
            this.showResultModal(
              'FAILED',
              'Votre solde est insuffisant pour effectuer cette opération.',
           
            );
          }
          
          
          else {
            // Show error in result modal
            this.showResultModal(
              'FAILED',
              data.message || 'Une erreur est survenue lors du traitement du paiement',
              data.reference || ''
            );
          }
        })
        .catch(error => {
          // console.error('FeexPay: Payment processing error', error);
          
          // Show error in result modal
          this.showResultModal(
            'FAILED',
            'Une erreur est survenue lors du traitement du paiement',
            ''
          );
        });
      },
      
      /**
       * Poll transaction status every 5 seconds
       */
      // Fonction utilisée pour vérifier l'état d'une transaction
      pollTransactionStatus: function(reference, payBtn, paymentData) {
        // Create a counter for polling attempts
        let pollCount = 0;
        const maxPolls = 6; // 2 minutes max (6 * 20 seconds)
        
        // Create polling interval
        const pollInterval = setInterval(() => {
          // Increment poll count
          pollCount++;
          
          // Check transaction status
          fetch(`${FeexPayConfig.baseUrl}/api/transactions/getrequesttopay/integration/${reference}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${FeexPayConfig.options.token}`
            }
          })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'SUCCESSFUL') {
              // Clear interval and handle success
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with success message
              FeexPayButton.showResultModal(
                'SUCCESSFUL',
                'Votre paiement a été traité avec succès.',
                data.reference || reference
              );
            } 
            else if (data.reason ==="LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED") {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              
              // Show result modal with failure message
              FeexPayButton.showResultModal(
                'FAILED',
                'Votre solde est insuffisant pour effectuer cette opération.',
                // reference
              );
            } 
            else if (data.reason ==="PAYER_NOT_FOUND") {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              
              // Show result modal with failure message
              FeexPayButton.showResultModal(
                'FAILED',
                'Veuillez bien vérifier le numéro de téléphone et le réseau selectionné',
                // reference
              );
            } 
            else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with failure message
              FeexPayButton.showResultModal(
                'FAILED',
                'Le paiement a échoué ou a été annulé.',
                reference
              );
            } 
            else if (pollCount >= maxPolls) {
              // Timeout after max polls
              clearInterval(pollInterval);
              
              // Show result modal with timeout message
              FeexPayButton.showResultModal(
                'FAILED',
                'La vérification du paiement a expiré. Veuillez réessayer.',
                reference
              );
            } else {
              // Update button text to show we're still checking
              if (payBtn) {
                payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
              }
            }
          })
          .catch(error => {
            // Clear interval on error
            clearInterval(pollInterval);
            // console.error('FeexPay: Error checking transaction status', error);
            
            // Show result modal with error message
            FeexPayButton.showResultModal(
              'FAILED',
              'Une erreur est survenue lors de la vérification du paiement.',
              reference
            );
          });
        }, 20000); // Poll every 20 seconds
      },
      
      /**
       * Handle successful transaction
       */
      handleSuccessfulTransaction: function(data) {
        // Hide payment modal
        this.hidePaymentModal();
        
        // Show result modal with success message
        this.showResultModal(
          'SUCCESSFUL',
          'Votre paiement a été traité avec succès.',
          data.transaction_id || data.reference || ('FP-' + Math.random().toString(36).substring(2, 11).toUpperCase())
        );
      },
      
      /**
       * Process CORIS payment with OTP verification
       */
      processCorisPayment: function(paymentData) {
        // console.log('CORIS payment data:', paymentData);
        
        // Get the pay button reference
        const payBtn = document.getElementById('feexpay-pay-btn');
        
        // Format the phone number correctly
        const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
        const phone = walletPhoneInput?.value.trim();
        
        if (!phone) {
          this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          return;
        }
        
        // Format the phone number according to the required format
        let country = '';
        let phoneNumberRight = '';
        
        // Déterminer le code pays en fonction du pays sélectionné
        const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
        if (walletCountrySelect?.value === 'Benin') {
          country = '229';
        } else {
          // Par défaut, utiliser le code du Bénin
          country = '229';
        }
        
        // Formater le numéro de téléphone
        // Enlever tous les caractères non numériques
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Si le numéro commence par le code pays, l'enlever
        if (cleanPhone.startsWith(country)) {
          cleanPhone = cleanPhone.substring(country.length);
        }
        
        // Si le numéro commence par un 0, l'enlever
        // if (cleanPhone.startsWith('0')) {
        //   cleanPhone = cleanPhone.substring(1);
        // }
        
        // Formater le numéro de téléphone pour la partie droite
        phoneNumberRight = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
        
        // Numéro de téléphone complet avec code pays
        const phoneNumber = country + cleanPhone;
        
        // Préparer les données de paiement selon le format requis
        const formattedPaymentData = {
          phoneNumber: phoneNumber,
          country: country,
          phoneNumberRight: phoneNumberRight,
          amount: paymentData.amount.toString(),
          currency: FeexPayConfig.options.currency,
          description: FeexPayConfig.options.description || 'Paiement FeexPay',
          reseau: 'CORIS',
          shop: FeexPayConfig.options.id,
          token: FeexPayConfig.options.token,
          otp: '', // OTP vide pour la première requête
          reference: ''
        };
        
        // Ajouter email et first_name seulement s'ils sont disponibles
        if (paymentData.email) {
          formattedPaymentData.email = paymentData.email;
        }
        
        if (paymentData.first_name) {
          formattedPaymentData.first_name = paymentData.first_name;
        }
        
        // Make initial request to get OTP
        // console.log('Sending CORIS payment request to:', `${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`);
        // console.log('With payload:', JSON.stringify(formattedPaymentData, null, 2));
        
        // Show loading state
        if (payBtn) {
          payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          payBtn.disabled = true;
        }
        
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${formattedPaymentData.token}`
          },
          body: JSON.stringify(formattedPaymentData)
        })
        .then(response => {
          // console.log('CORIS response status:', response.status);
          return response.json().then(data => {
            return { status: response.status, data };
          });
        })
        .then(({ status, data }) => {
          // console.log('CORIS response data:', data);
          
          // Store reference if available
          if (data.reference) {
            formattedPaymentData.reference = data.reference;
          }
          
          // Check if OTP is required (status 201)
          if (status === 201) {
            // console.log('OTP required, showing OTP modal');
            // Show OTP input modal
            this.showOtpModal(formattedPaymentData, data);
          } else if (status === 200 || data.status === 'SUCCESSFUL') {
            // Payment successful without OTP
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            
            this.showResultModal(
              'SUCCESSFUL',
              data.message || 'Votre paiement a été traité avec succès.',
              data.reference || ''
            );
          } else {
            // Error response
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            
            this.showResultModal(
              'FAILED',
              data.message || 'Une erreur est survenue lors du traitement du paiement CORIS',
              data.reference || ''
            );
          }
        })
        .catch(error => {
          // console.error('FeexPay: CORIS payment processing error', error);
          
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          // Show error in result modal
          this.showResultModal(
            'FAILED',
            'Une erreur est survenue lors du traitement du paiement CORIS',
            ''
          );
        });
      },
      
      /**
       * Show OTP input modal for CORIS payments
       * @param {Object} paymentData - Payment data for CORIS
       * @param {Object} initialResponse - Initial response from the API
       */
      showOtpModal: function(paymentData, initialResponse) {
        // Create OTP modal if it doesn't exist
        if (!FeexPayConfig.otpModalElement) {
          const otpModalOverlay = document.createElement('div');
          otpModalOverlay.className = 'feexpay-otp-modal-overlay';
          otpModalOverlay.style.position = 'fixed';
          otpModalOverlay.style.top = '0';
          otpModalOverlay.style.left = '0';
          otpModalOverlay.style.width = '100%';
          otpModalOverlay.style.height = '100%';
          otpModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          otpModalOverlay.style.display = 'flex';
          otpModalOverlay.style.alignItems = 'center';
          otpModalOverlay.style.justifyContent = 'center';
          otpModalOverlay.style.zIndex = '9999';
          otpModalOverlay.style.opacity = '0';
          otpModalOverlay.style.visibility = 'hidden';
          otpModalOverlay.style.transition = 'opacity 0.3s, visibility 0.3s';
          
          const otpModal = document.createElement('div');
          otpModal.className = 'feexpay-otp-modal';
          otpModal.style.backgroundColor = 'white';
          otpModal.style.borderRadius = '8px';
          otpModal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          otpModal.style.width = '90%';
          otpModal.style.maxWidth = '400px';
          otpModal.style.overflow = 'hidden';
          otpModal.style.transform = 'scale(0.9)';
          otpModal.style.transition = 'transform 0.3s';
          
          otpModalOverlay.appendChild(otpModal);
          document.body.appendChild(otpModalOverlay);
          
          FeexPayConfig.otpModalElement = otpModalOverlay;
        }
        
        // Get the modal content container
        const otpModal = FeexPayConfig.otpModalElement.querySelector('.feexpay-otp-modal');
        
        // Set the modal content
        otpModal.innerHTML = `
          <div style="padding: 24px; text-align: center;">
            <div style="color: #D45D00; margin-bottom: 16px;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #112C56;">Code OTP requis</h3>
            <p style="color: #6b7280; margin-bottom: 16px;">Un code OTP a été envoyé à votre numéro de téléphone. Veuillez l'entrer ci-dessous pour compléter la transaction.</p>
            
            <div style="margin-bottom: 16px;">
              <input type="text" id="feexpay-otp-input" placeholder="Entrez le code OTP" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; text-align: center; font-size: 18px; letter-spacing: 2px;">
            </div>
            
            <div id="feexpay-otp-message" style="color: #ef4444; margin-bottom: 16px; font-size: 14px; min-height: 20px;"></div>
            
            <div style="display: flex; justify-content: space-between;">
              <button id="feexpay-otp-cancel" style="padding: 8px 16px; background-color: #f3f4f6; color: #4b5563; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
                Annuler
              </button>
              <button id="feexpay-otp-submit" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
                Valider
              </button>
            </div>
          </div>
        `;
        
        // Add event listeners
        const cancelBtn = otpModal.querySelector('#feexpay-otp-cancel');
        const submitBtn = otpModal.querySelector('#feexpay-otp-submit');
        const otpInput = otpModal.querySelector('#feexpay-otp-input');
        const otpMessage = otpModal.querySelector('#feexpay-otp-message');
        
        // Store initialResponse in FeexPayConfig for later use
        FeexPayConfig.initialCorisResponse = initialResponse;
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            this.hideOtpModal();
            
            // Reset the payment button
            const payBtn = document.getElementById('feexpay-pay-btn');
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            
            this.showResultModal('FAILED', 'Paiement annulé par l\'utilisateur', '');
          });
        }
        
        if (submitBtn && otpInput) {
          submitBtn.addEventListener('click', () => {
            const otpValue = otpInput.value.trim();
            
            if (!otpValue) {
              if (otpMessage) otpMessage.textContent = 'Veuillez entrer le code OTP';
              return;
            }
            
            // Update button state
            submitBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
            submitBtn.disabled = true;
            
            // Add OTP to payment data
            const otpPaymentData = {...paymentData};
            otpPaymentData.otp = otpValue;
            
            // Submit payment with OTP
            // console.log('Submitting OTP payment with data:', otpPaymentData);
            
            fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${otpPaymentData.token}`
              },
              body: JSON.stringify(otpPaymentData)
            })
            .then(response => {
              // console.log('OTP submission response status:', response.status);
              return response.json().then(data => {
                return { status: response.status, data };
              });
            })
            .then(({ status, data }) => {
              // console.log('OTP submission response data:', data);
              
              // Hide OTP modal
              this.hideOtpModal();
              
              // Reset the payment button
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              if ( data.status === 'SUCCESSFUL' || 
                 
                  (data.message && data.message.toLowerCase().includes('succ'))) {
                // console.log('Payment successful');
                // Show success result modal
                this.showResultModal(
                  'SUCCESSFUL',
                  data.message || 'Votre paiement a été traité avec succès.',
                  data.reference || (initialResponse && initialResponse.reference) || ''
                );
                
                // Call the callback function if it exists
                if (typeof FeexPayConfig.options.callback === 'function') {
                  const callbackData = {
                    status: 'SUCCESSFUL',
                    message: data.message || 'Paiement réussi',
                    reference: data.reference || (initialResponse && initialResponse.reference) || '',
                    transactionId: data.transactionId || (initialResponse && initialResponse.transactionId) || '',
                    amount: paymentData.amount,
                    method: 'wallet',
                    provider: 'CORIS',
                    callback_info : FeexPayConfig.options.callback_info,
                  };
                  
                  FeexPayConfig.options.callback(callbackData);
                }
              } else {
                // console.log('Payment failed');
                // Show error result modal
                this.showResultModal(
                  'FAILED',
                  data.message || 'Une erreur est survenue lors de la validation du code OTP',
                  data.reference || (initialResponse && initialResponse.reference) || ''
                );
                
                // Call the callback function if it exists
                if (typeof FeexPayConfig.options.callback === 'function') {
                  const callbackData = {
                    status: 'FAILED',
                    message: data.message || 'Erreur lors de la validation du code OTP',
                    reference: data.reference || (initialResponse && initialResponse.reference) || '',
                    transactionId: data.transactionId || (initialResponse && initialResponse.transactionId) || '',
                    amount: paymentData.amount,
                    method: 'wallet',
                    provider: 'CORIS',
                    callback_info : FeexPayConfig.options.callback_info,
                  };
                  
                  FeexPayConfig.options.callback(callbackData);
                }
              }
            })
            .catch(error => {
              // console.error('FeexPay: OTP validation error', error);
              
              // Hide OTP modal
              this.hideOtpModal();
              
              // Reset the payment button
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show error result modal
              this.showResultModal(
                'FAILED',
                'Une erreur est survenue lors de la validation du code OTP',
                (initialResponse && initialResponse.reference) || ''
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'FAILED',
                  message: 'Erreur lors de la validation du code OTP',
                  reference: (initialResponse && initialResponse.reference) || '',
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'CORIS',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            });
          });
        }
        
        // Show the modal
        FeexPayConfig.otpModalElement.style.opacity = '1';
        FeexPayConfig.otpModalElement.style.visibility = 'visible';
        otpModal.style.transform = 'scale(1)';
        
        // Focus on OTP input
        if (otpInput) {
          setTimeout(() => {
            otpInput.focus();
          }, 300);
        }
      },
      
      /**
       * Hide the OTP modal
       */
      /**
       * Process card payment
       */
      processCardPayment: function() {
        // Get card information
        const firstNameInput = document.getElementById('feexpay-firstname-input');
        const lastNameInput = document.getElementById('feexpay-lastname-input');
        const emailInput = document.getElementById('feexpay-card-email-input');
        const phoneInput = document.getElementById('feexpay-card-phone-input');
        const cardTypeSelect = document.getElementById('feexpay-card-type');
        
        if (!firstNameInput || !lastNameInput || !emailInput || !phoneInput || !cardTypeSelect) {
          console.error('FeexPay: Required card form elements not found');
          return;
        }
        
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const typeCard = cardTypeSelect.value;
        
        // Validate inputs
        if (!firstName) {
          this.showResultModal('FAILED', 'Veuillez entrer votre prénom', '');
          return;
        }
        
        if (!lastName) {
          this.showResultModal('FAILED', 'Veuillez entrer votre nom', '');
          return;
        }
        
        if (!email) {
          this.showResultModal('FAILED', 'Veuillez entrer votre adresse email', '');
          return;
        }
        
        if (!phone) {
          this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
          return;
        }
        
        // Get the pay button reference
        const payBtn = document.getElementById('feexpay-pay-btn');
        
        // Show loading state
        if (payBtn) {
          payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          payBtn.disabled = true;
        }
        
        // Calculer le montant avec les frais de 4,5%
        const feeAmount = Math.ceil(FeexPayConfig.options.amount * 0.045);
        const totalAmount = FeexPayConfig.options.amount + feeAmount;
        
        let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques
  
        
        // Prepare payment data
        const paymentData = {
          amount: FeexPayConfig.options.amount,
          phone: cleanPhone,
          shop: FeexPayConfig.options.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          type_card: typeCard,
          currency: FeexPayConfig.options.currency,
          // fee: feeAmount,
          // total: totalAmount
        };
        
        // Make API request to process card payment
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/initcard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FeexPayConfig.options.token}`
          },
          body: JSON.stringify(paymentData)
        })
        .then(response => response.json())
        .then(data => {
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          // Check response
          if (data.status === 'SUCCESSFUL' || data.status === 200) {
            // Reset callback flag for new transaction
            FeexPayConfig.callbackCalled = false;
            
            // Redirect to payment page if URL is provided
            if (data.url) {
              window.location.href = data.url;
            } else {
              this.showResultModal(
                'SUCCESSFUL',
                data.message || 'Votre paiement a été initié avec succès. Vous allez être redirigé vers la page de paiement.',
                data.reference || ''
              );
            }
          } else {
            // Show error
            this.showResultModal(
              'FAILED',
              data.message || 'Une erreur est survenue lors de l\'initialisation du paiement par carte',
              data.reference || ''
            );
          }
        })
        .catch(error => {
          // console.error('FeexPay: Card payment processing error', error);
          
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          // Show error
          this.showResultModal(
            'FAILED',
            'Une erreur est survenue lors de l\'initialisation du paiement par carte',
            ''
          );
        });
      },
      
      /**
       * Hide the OTP modal
       */
      /**
     * Process wallet payment
     */
    processWalletPayment: function() {
      const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
      const walletProviderSelect = document.getElementById('feexpay-wallet-provider-select');
      const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
      
      // Vérifier si les champs sont masqués
      const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
      const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');
      
      // Utiliser l'email et le nom de la section Informations Personnelles si disponible et non masqués
      const nameInput = hideNameField ? null : document.getElementById('feexpay-name-input');
      const emailInput = hideEmailField ? null : document.getElementById('feexpay-email-input');
      
      const country = walletCountrySelect?.value;
      const provider = walletProviderSelect?.value;
      const phone = walletPhoneInput?.value;
      const name = (nameInput?.value || '');
      const email = (emailInput?.value || '');
      
      // Validation
      if (!phone) {
        this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
        return;
      }
      
      // Validation de l'email seulement si le champ n'est pas masqué
      if (!hideEmailField && !email) {
        this.showResultModal('FAILED', 'Veuillez entrer votre adresse email', '');
        return;
      }
      
      // Validation du nom seulement si le champ n'est pas masqué
      if (!hideNameField && !name) {
        this.showResultModal('FAILED', 'Veuillez entrer votre nom', '');
        return;
      }
      
      // Get the pay button reference
      const payBtn = document.getElementById('feexpay-pay-btn');
      
      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }
      
      // Déterminer le taux de frais en fonction du pays et du fournisseur
      let feeRate = 0.017; // Taux par défaut (1,7%)
      
      // Appliquer le taux de frais approprié en fonction du pays et du fournisseur
      if (country === 'Benin' && provider === 'CORIS') {
        feeRate = 0.017; // 1,7% pour Coris au Bénin
      } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
        feeRate = 0.032; // 2,9% pour Wave en Côte d'Ivoire
      }
      
      // Préparer les données pour la requête de vérification des frais
      const checkFeesData = {
        amount: FeexPayConfig.options.amount,
        reseau: provider,
        shop: FeexPayConfig.options.id
      };
      
      // Faire une requête API pour vérifier si les frais doivent être appliqués
      fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkFeesData)
      })
      .then(response => response.json())
      .then(data => {
        // Déterminer si les frais doivent être appliqués
        const shouldApplyFees = data.iffees === true;
        // console.log('FeexPay Wallet Payment: Should apply fees:', shouldApplyFees, data);
        
        // Calculer les frais et le montant total
        let feeAmount = 0;
        if (shouldApplyFees) {
          feeAmount = Math.ceil(FeexPayConfig.options.amount * feeRate);
        }
        const totalAmount = FeexPayConfig.options.amount + feeAmount;
        
        // Prepare payment data
        const paymentData = {
          amount: FeexPayConfig.options.amount,
          phone: phone,
          shop: FeexPayConfig.options.id,
          currency: FeexPayConfig.options.currency,
          fee: feeAmount,
          total: totalAmount,
          country: country,
          provider: provider
        };
        
        // Ajouter email seulement s'il n'est pas masqué et qu'il est disponible
        if (!hideEmailField && email) {
          paymentData.email = email;
        }
        
        // Ajouter first_name et last_name seulement s'ils ne sont pas masqués et qu'ils sont disponibles
        if (!hideNameField && name) {
          paymentData.first_name = name.split(' ')[0] || '';
          paymentData.last_name = name.split(' ').slice(1).join(' ') || '';
        }
        
        // Determine the API endpoint based on the provider
        let apiEndpoint = '';
        let networkApiId = '';
        
        if (country === 'Benin' && provider === 'CORIS') {
          apiEndpoint = `${FeexPayConfig.baseUrl}/api/transactions/public/init`;
          networkApiId = 'coris';
        } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
          apiEndpoint = `${FeexPayConfig.baseUrl}/api/transactions/public/init`;
          networkApiId = 'wave_ci';
        } else {
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          this.showResultModal('FAILED', 'Fournisseur de wallet non pris en charge', '');
          return;
        }
        
        // Make API request to process wallet payment
        this.submitPayment(networkApiId, paymentData);
      })
      .catch(error => {
        // console.error('Error checking transaction fees for wallet payment:', error);
        
        // En cas d'erreur, procéder sans appliquer de frais
        const feeAmount = 0;
        const totalAmount = FeexPayConfig.options.amount;
        
        // Prepare payment data without fees
        const paymentData = {
          amount: FeexPayConfig.options.amount,
          phone: phone,
          shop: FeexPayConfig.options.id,
          currency: FeexPayConfig.options.currency,
          fee: feeAmount,
          total: totalAmount,
          country: country,
          provider: provider
        };
        
        // Ajouter email seulement s'il n'est pas masqué et qu'il est disponible
        if (!hideEmailField && email) {
          paymentData.email = email;
        }
        
        // Ajouter first_name et last_name seulement s'ils ne sont pas masqués et qu'ils sont disponibles
        if (!hideNameField && name) {
          paymentData.first_name = name.split(' ')[0] || '';
          paymentData.last_name = name.split(' ').slice(1).join(' ') || '';
        }
        
        // Determine the API endpoint based on the provider
        let networkApiId = '';
        
        if (country === 'Benin' && provider === 'CORIS') {
          networkApiId = 'coris';
        } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
          networkApiId = 'wave_ci';
        } else {
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          this.showResultModal('FAILED', 'Fournisseur de wallet non pris en charge', '');
          return;
        }
        
        // Make API request to process wallet payment without fees
        this.submitPayment(networkApiId, paymentData);
      });
    },
    
    /**
     * Hide the OTP modal
     */
    hideOtpModal: function() {
        if (!FeexPayConfig.otpModalElement) return;
        
        const otpModal = FeexPayConfig.otpModalElement.querySelector('.feexpay-otp-modal');
        
        // Animate out
        FeexPayConfig.otpModalElement.style.opacity = '0';
        FeexPayConfig.otpModalElement.style.visibility = 'hidden';
        if (otpModal) {
          otpModal.style.transform = 'scale(0.9)';
        }
      },
      
      /**
       * Process WAVE CI payment
       * @param {Object} paymentData - Payment data for WAVE CI
       */
      /**
       * Poll transaction status for WAVE payments every 5 seconds
       * @param {string} reference - Transaction reference
       * @param {HTMLElement} payBtn - Payment button element
       * @param {Object} paymentData - Original payment data
       */
      pollWaveTransactionStatus: function(reference, payBtn, paymentData) {
        // Create a counter for polling attempts
        let pollCount = 0;
        const maxPolls = 24; // 2 minutes max (24 * 5 seconds)
        
        // Create polling interval
        const pollInterval = setInterval(() => {
          // Increment poll count
          pollCount++;
          
          // Check transaction status
          fetch(`${FeexPayConfig.baseUrl}/api/transactions/getrequesttopay/integration/${reference}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${FeexPayConfig.options.token}`
            }
          })
          .then(response => response.json())
          .then(data => {
            // console.log('WAVE polling response:', data);
            
            if (data.status === 'SUCCESSFUL') {
              // Clear interval and handle success
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with success message
              this.showResultModal(
                'SUCCESSFUL',
                'Votre paiement a été traité avec succès.',
                data.reference || reference
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'SUCCESSFUL',
                  message: data.message || 'Paiement réussi',
                  reference: data.reference || reference,
                  transactionId: data.transactionId || '',
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'WAVE',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            } 
            else if (data.reason === "LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED") {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with failure message
              this.showResultModal(
                'FAILED',
                'Votre solde est insuffisant pour effectuer cette opération.',
                reference
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'FAILED',
                  message: 'Votre solde est insuffisant pour effectuer cette opération.',
                  reference: reference,
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'WAVE',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            } 
            else if (data.reason === "PAYER_NOT_FOUND") {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with failure message
              this.showResultModal(
                'FAILED',
                'Veuillez bien vérifier le numéro de téléphone et le réseau selectionné',
                reference
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'FAILED',
                  message: 'Veuillez bien vérifier le numéro de téléphone et le réseau selectionné',
                  reference: reference,
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'WAVE',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            } 
            else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
              // Clear interval and handle failure
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with failure message
              this.showResultModal(
                'FAILED',
                'Le paiement a échoué ou a été annulé.',
                reference
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'FAILED',
                  message: 'Le paiement a échoué ou a été annulé.',
                  reference: reference,
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'WAVE',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            } 
            else if (pollCount >= maxPolls) {
              // Timeout after max polls
              clearInterval(pollInterval);
              
              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              
              // Show result modal with timeout message
              this.showResultModal(
                'FAILED',
                'La vérification du paiement a expiré. Veuillez réessayer.',
                reference
              );
              
              // Call the callback function if it exists
              if (typeof FeexPayConfig.options.callback === 'function') {
                const callbackData = {
                  status: 'FAILED',
                  message: 'La vérification du paiement a expiré. Veuillez réessayer.',
                  reference: reference,
                  amount: paymentData.amount,
                  method: 'wallet',
                  provider: 'WAVE',
                  callback_info : FeexPayConfig.options.callback_info,
                };
                
                FeexPayConfig.options.callback(callbackData);
              }
            } else {
              // Update button text to show we're still checking
              if (payBtn) {
                payBtn.innerHTML = `<span class="feexpay-loading-spinner"></span> Vérification du paiement (${pollCount}/${maxPolls})...`;
              }
            }
          })
          .catch(error => {
            // Clear interval on error
            clearInterval(pollInterval);
            // console.error('FeexPay: Error checking WAVE transaction status', error);
            
            // Reset the payment button
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            
            // Show result modal with error message
            this.showResultModal(
              'FAILED',
              'Une erreur est survenue lors de la vérification du paiement.',
              reference
            );
            
            // Call the callback function if it exists
            if (typeof FeexPayConfig.options.callback === 'function') {
              const callbackData = {
                status: 'FAILED',
                message: 'Une erreur est survenue lors de la vérification du paiement.',
                reference: reference,
                amount: paymentData.amount,
                callback_info : FeexPayConfig.options.callback_info,
              };
              
              FeexPayConfig.options.callback(callbackData);
            }
          });
        }, 5000); // Poll every 5 seconds
      },
      
      /**
       * Process WAVE CI payment
       * @param {Object} paymentData - Payment data for WAVE CI
       */
      processWaveCIPayment: function(paymentData) {
        //   console.log('WAVE CI payment data:', paymentData);
        
        // Get the pay button reference
        const payBtn = document.getElementById('feexpay-pay-btn');
        
        // Format the phone number correctly
        const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
        const phone = walletPhoneInput?.value.trim();
        
        if (!phone) {
          this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          return;
        }
        
        // Format the phone number according to the required format
        let country = '';
        let phoneNumberRight = '';
        
        // Déterminer le code pays en fonction du pays sélectionné
        const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
        if (walletCountrySelect?.value === 'Côte d\'Ivoire') {
          country = '225';
        } else {
          // Par défaut, utiliser le code de la Côte d'Ivoire
          country = '225';
        }
        
        // Formater le numéro de téléphone
        // Enlever tous les caractères non numériques
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Si le numéro commence par le code pays, l'enlever
        if (cleanPhone.startsWith(country)) {
          cleanPhone = cleanPhone.substring(country.length);
        }
        
        // Si le numéro commence par un 0, l'enlever
        if (cleanPhone.startsWith('0')) {
          cleanPhone = cleanPhone.substring(1);
        }
        
        // Formater le numéro de téléphone pour la partie droite
        phoneNumberRight = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
        
        // Numéro de téléphone complet avec code pays
        const phoneNumber = country + cleanPhone;
        
        // Préparer les données de callback_info
        const callback_info = {
          custom_id: FeexPayConfig.options.custom_id || '',
          description: FeexPayConfig.options.description || 'Paiement FeexPay'
        };
        
        // Préparer les données de paiement selon le format requis
        const formattedPaymentData = {
          phoneNumber: phoneNumber,
          country: country,
          phoneNumberRight: phoneNumberRight,
          amount: paymentData.amount.toString(),
          currency: FeexPayConfig.options.currency,
          description: FeexPayConfig.options.description || 'Paiement FeexPay',
          callback_info: callback_info,
          reseau: 'WAVE_CI',
          shop: FeexPayConfig.options.id,
          token: FeexPayConfig.options.token,
          
        };
        
        // Ajouter email et first_name seulement s'ils sont disponibles
        if (paymentData.email) {
          formattedPaymentData.email = paymentData.email;
        } else {
          formattedPaymentData.email = ''; // Email par défaut
        }
        
        if (paymentData.first_name) {
          formattedPaymentData.first_name = paymentData.first_name;
        } else {
          formattedPaymentData.first_name = '' // Nom par défaut
        }
        
        // Make API request
        // console.log('Sending WAVE CI payment request to:', `${FeexPayConfig.baseUrl}/api/transactions/public/requesttopay/wave_ci`);
        // console.log('With payload:', JSON.stringify(formattedPaymentData, null, 2));
        
        // Show loading state
        if (payBtn) {
          payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          payBtn.disabled = true;
        }
        
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${formattedPaymentData.token}`
          },
          body: JSON.stringify(formattedPaymentData)
        })
        .then(response => {
          // console.log('WAVE CI response status:', response.status);
          return response.json().then(data => {
            return { status: response.status, data };
          });
        })
        .then(({ status, data }) => {
          // console.log('WAVE CI response data:', data);
          
          // Vérifier si nous avons une référence pour vérifier le statut final
          if (data.reference) {
            // console.log('Payment reference received, starting polling:', data.reference);
            
            // Update button to show polling status
            if (payBtn) {
              payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> Vérification du paiement...';
            }
            
            // Start polling for transaction status
            this.pollWaveTransactionStatus(data.reference, payBtn, formattedPaymentData);
          } else {
            // console.log('No reference received, cannot check payment status');
            
            // Reset the payment button
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }
            
            // Show error result modal
            this.showResultModal(
              'PAYER_NOT_FOUND',
              'Veuillez bien vérifiez le numéro de téléphone et le réseau selectionné',
              ''
            );
            
        
          }
        })
        .catch(error => {
          // console.error('FeexPay: WAVE CI payment processing error', error);
          
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          
          // Show error in result modal
          this.showResultModal(
            'FAILED',
            'Une erreur est survenue lors du traitement du paiement WAVE',
            ''
          );
          
          // Call the callback function if it exists
          if (typeof FeexPayConfig.options.callback === 'function') {
            const callbackData = {
              status: 'FAILED',
              message: 'Erreur lors du traitement du paiement',
              reference: reference,
              amount: paymentData.amount,
      
     
              callback_info : FeexPayConfig.options.callback_info,
              phoneNumber : paymentData.phoneNumber,
            };
            
            FeexPayConfig.options.callback(callbackData);
          }
        });
      }
    };
    
    // Expose FeexPayButton to the global scope
    window.FeexPayButton = FeexPayButton;
  })();